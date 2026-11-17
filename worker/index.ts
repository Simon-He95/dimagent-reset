import {
  LIVE_WINDOW_MINUTES,
  MAX_CLICKS_PER_REQUEST,
  MINUTE_RETENTION_MINUTES,
  UNKNOWN_COUNTRY,
  type ClickResponse,
  type CountryCount,
  type RegionCount,
  type StatsSnapshot,
} from '../shared/contract'
import type { Env } from './env'

type Row = Record<string, unknown>

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (url.pathname === '/api/click') {
        if (request.method !== 'POST') return methodNotAllowed('POST')
        return await handleClick(request, env, ctx)
      }

      if (url.pathname === '/api/stats') {
        if (request.method !== 'GET') return methodNotAllowed('GET')
        return await handleStats(request, env)
      }

      if (url.pathname.startsWith('/api/')) {
        return json({ error: 'not_found' }, 404)
      }

      return await env.ASSETS.fetch(request)
    } catch (error) {
      console.error('request_failed', {
        path: url.pathname,
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
      })
      return json({ error: 'internal_error' }, 500)
    }
  },
} satisfies ExportedHandler<Env>

async function handleClick(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ error: 'json_required' }, 415)
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > 512) return json({ error: 'body_too_large' }, 413)

  const raw = await request.text()
  if (raw.length > 512) return json({ error: 'body_too_large' }, 413)

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (!isRecord(body)) return json({ error: 'invalid_body' }, 400)
  const count = body.count
  if (
    typeof count !== 'number' ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_CLICKS_PER_REQUEST
  ) {
    return json({ error: 'invalid_count' }, 400)
  }

  const now = Date.now()
  const day = new Date(now).toISOString().slice(0, 10)
  const minute = Math.floor(now / 60_000)
  const location = readLocation(request)

  const clickStatements = [
    env.DB.prepare(
      `INSERT INTO totals (scope, clicks, updated_at) VALUES ('global', ?, ?)
       ON CONFLICT(scope) DO UPDATE SET clicks = clicks + excluded.clicks, updated_at = excluded.updated_at`,
    ).bind(count, now),
    env.DB.prepare(
      `INSERT INTO country_totals (country, clicks) VALUES (?, ?)
       ON CONFLICT(country) DO UPDATE SET clicks = clicks + excluded.clicks`,
    ).bind(location.country, count),
    env.DB.prepare(
      `INSERT INTO region_totals (country, region, clicks) VALUES (?, ?, ?)
       ON CONFLICT(country, region) DO UPDATE SET clicks = clicks + excluded.clicks`,
    ).bind(location.country, location.region, count),
    env.DB.prepare(
      `INSERT INTO daily_regions (day, country, region, clicks) VALUES (?, ?, ?, ?)
       ON CONFLICT(day, country, region) DO UPDATE SET clicks = clicks + excluded.clicks`,
    ).bind(day, location.country, location.region, count),
    env.DB.prepare(
      `INSERT INTO minute_regions (minute, country, region, clicks) VALUES (?, ?, ?, ?)
       ON CONFLICT(minute, country, region) DO UPDATE SET clicks = clicks + excluded.clicks`,
    ).bind(minute, location.country, location.region, count),
  ]

  const readStatements = statsStatements(env.DB, { day, minute })
  const results = await env.DB.batch([...clickStatements, ...readStatements])
  const stats = parseStats(results.slice(clickStatements.length), location, now)
  const response: ClickResponse = { ...stats, accepted: count }

  if (Math.random() < 0.02) {
    ctx.waitUntil(
      env.DB.prepare('DELETE FROM minute_regions WHERE minute < ?')
        .bind(minute - MINUTE_RETENTION_MINUTES)
        .run()
        .catch(() => undefined),
    )
  }

  return json(response, 200)
}

async function handleStats(request: Request, env: Env): Promise<Response> {
  const now = Date.now()
  const day = new Date(now).toISOString().slice(0, 10)
  const minute = Math.floor(now / 60_000)
  const location = readLocation(request)
  const results = await env.DB.batch(statsStatements(env.DB, { day, minute }))
  return json(parseStats(results, location, now), 200)
}

function statsStatements(db: D1Database, input: { day: string; minute: number }) {
  return [
    db.prepare("SELECT clicks FROM totals WHERE scope = 'global'"),
    db.prepare('SELECT COALESCE(SUM(clicks), 0) AS today FROM daily_regions WHERE day = ?').bind(
      input.day,
    ),
    db.prepare('SELECT COALESCE(SUM(clicks), 0) AS recent FROM minute_regions WHERE minute >= ?').bind(
      input.minute - LIVE_WINDOW_MINUTES + 1,
    ),
    db.prepare(
      "SELECT COUNT(*) AS countries FROM country_totals WHERE country <> 'XX'",
    ),
    db.prepare(
      'SELECT country, clicks FROM country_totals ORDER BY clicks DESC, country ASC LIMIT 8',
    ),
    db.prepare(
      "SELECT country, region, clicks FROM region_totals WHERE region <> '' AND country <> 'XX' ORDER BY clicks DESC, country ASC LIMIT 5",
    ),
  ]
}

function parseStats(
  results: D1Result<unknown>[],
  location: { country: string; region: string },
  updatedAt: number,
): StatsSnapshot {
  const totalRow = firstRow(results[0])
  const todayRow = firstRow(results[1])
  const recentRow = firstRow(results[2])
  const countriesRow = firstRow(results[3])
  const topCountries = rows(results[4]).flatMap(toCountryCount)
  const topRegions = rows(results[5]).flatMap(toRegionCount)

  return {
    total: toInt(totalRow.clicks),
    today: toInt(todayRow.today),
    last5m: toInt(recentRow.recent),
    countries: toInt(countriesRow.countries),
    topCountries,
    topRegions,
    yourCountry: location.country === UNKNOWN_COUNTRY ? null : location.country,
    yourRegion: location.region || null,
    updatedAt,
  }
}

function readLocation(request: Request): { country: string; region: string } {
  const cf = (request as Request & { cf?: { country?: unknown; region?: unknown } }).cf
  const country = typeof cf?.country === 'string' && /^[A-Z]{2}$/.test(cf.country)
    ? cf.country
    : UNKNOWN_COUNTRY
  const region = typeof cf?.region === 'string' ? cf.region.trim().slice(0, 80) : ''
  return { country, region }
}

function toCountryCount(row: Row): CountryCount[] {
  const country = typeof row.country === 'string' ? row.country : ''
  if (!/^[A-Z]{2}$/.test(country)) return []
  return [{ country, clicks: toInt(row.clicks) }]
}

function toRegionCount(row: Row): RegionCount[] {
  const country = typeof row.country === 'string' ? row.country : ''
  const region = typeof row.region === 'string' ? row.region : ''
  if (!/^[A-Z]{2}$/.test(country) || !region) return []
  return [{ country, region, clicks: toInt(row.clicks) }]
}

function firstRow(result: D1Result<unknown> | undefined): Row {
  return rows(result)[0] ?? {}
}

function rows(result: D1Result<unknown> | undefined): Row[] {
  if (!result || !Array.isArray(result.results)) return []
  return result.results.filter(isRecord)
}

function toInt(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0
}

function isRecord(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function methodNotAllowed(allow: string): Response {
  return json({ error: 'method_not_allowed' }, 405, { allow })
}

function json(value: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  })
}
