import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ClickResponse, StatsSnapshot } from '../shared/contract'

type WorkerRequestInit = RequestInit & {
  cf?: { country?: string; region?: string }
}

const BASE = 'https://reset.test'

async function clearDatabase() {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM totals'),
    env.DB.prepare('DELETE FROM country_totals'),
    env.DB.prepare('DELETE FROM region_totals'),
    env.DB.prepare('DELETE FROM daily_regions'),
    env.DB.prepare('DELETE FROM minute_regions'),
  ])
}

async function readStats(cf?: WorkerRequestInit['cf']): Promise<StatsSnapshot> {
  const init: WorkerRequestInit = { cf }
  const response = await SELF.fetch(`${BASE}/api/stats`, init)
  expect(response.status).toBe(200)
  return (await response.json()) as StatsSnapshot
}

async function click(count: number, cf?: WorkerRequestInit['cf']): Promise<ClickResponse> {
  const init: WorkerRequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ count }),
    cf,
  }
  const response = await SELF.fetch(`${BASE}/api/click`, init)
  expect(response.status).toBe(200)
  return (await response.json()) as ClickResponse
}

beforeEach(clearDatabase)

describe('reset petition API', () => {
  it('reports an empty ledger and the viewer location', async () => {
    const stats = await readStats({ country: 'CN', region: 'Shanghai' })

    expect(stats).toMatchObject({
      total: 0,
      today: 0,
      last5m: 0,
      countries: 0,
      topCountries: [],
      topRegions: [],
      yourCountry: 'CN',
      yourRegion: 'Shanghai',
    })
    expect(stats.updatedAt).toEqual(expect.any(Number))
  })

  it('persists clicks in every aggregate and returns the updated ledger', async () => {
    const response = await click(3, { country: 'CN', region: 'Shanghai' })

    expect(response.accepted).toBe(3)
    expect(response).toMatchObject({
      total: 3,
      today: 3,
      last5m: 3,
      countries: 1,
      topCountries: [{ country: 'CN', clicks: 3 }],
      topRegions: [{ country: 'CN', region: 'Shanghai', clicks: 3 }],
      yourCountry: 'CN',
      yourRegion: 'Shanghai',
    })

    const stats = await readStats({ country: 'CN', region: 'Shanghai' })
    expect(stats.total).toBe(3)
    expect(stats.today).toBe(3)
    expect(stats.last5m).toBe(3)

    const total = await env.DB.prepare(
      "SELECT clicks FROM totals WHERE scope = 'global'",
    ).first<{ clicks: number }>()
    const day = new Date().toISOString().slice(0, 10)
    const daily = await env.DB.prepare(
      'SELECT clicks FROM daily_regions WHERE day = ? AND country = ? AND region = ?',
    )
      .bind(day, 'CN', 'Shanghai')
      .first<{ clicks: number }>()
    const country = await env.DB.prepare(
      'SELECT clicks FROM country_totals WHERE country = ?',
    )
      .bind('CN')
      .first<{ clicks: number }>()
    const region = await env.DB.prepare(
      'SELECT clicks FROM region_totals WHERE country = ? AND region = ?',
    )
      .bind('CN', 'Shanghai')
      .first<{ clicks: number }>()
    const minute = await env.DB.prepare(
      'SELECT clicks FROM minute_regions WHERE country = ? AND region = ?',
    )
      .bind('CN', 'Shanghai')
      .first<{ clicks: number }>()

    expect(total?.clicks).toBe(3)
    expect(daily?.clicks).toBe(3)
    expect(country?.clicks).toBe(3)
    expect(region?.clicks).toBe(3)
    expect(minute?.clicks).toBe(3)
  })

  it('ranks countries and keeps total history separate from today', async () => {
    await click(2, { country: 'CN', region: 'Shanghai' })
    const response = await click(5, { country: 'US', region: 'California' })

    expect(response.total).toBe(7)
    expect(response.today).toBe(7)
    expect(response.countries).toBe(2)
    expect(response.topCountries).toEqual([
      { country: 'US', clicks: 5 },
      { country: 'CN', clicks: 2 },
    ])
    expect(response.topRegions).toEqual([
      { country: 'US', region: 'California', clicks: 5 },
      { country: 'CN', region: 'Shanghai', clicks: 2 },
    ])

    await env.DB.batch([
      env.DB.prepare("UPDATE totals SET clicks = clicks + 40 WHERE scope = 'global'"),
      env.DB.prepare(
        "INSERT INTO country_totals (country, clicks) VALUES ('DE', 40) ON CONFLICT(country) DO UPDATE SET clicks = clicks + 40",
      ),
      env.DB.prepare(
        "INSERT INTO region_totals (country, region, clicks) VALUES ('DE', 'Berlin', 40) ON CONFLICT(country, region) DO UPDATE SET clicks = clicks + 40",
      ),
      env.DB.prepare(
        "INSERT INTO daily_regions (day, country, region, clicks) VALUES ('2020-01-01', 'DE', 'Berlin', 40)",
      ),
    ])

    const stats = await readStats({ country: 'CN', region: 'Shanghai' })
    expect(stats.total).toBe(47)
    expect(stats.today).toBe(7)
    expect(stats.countries).toBe(3)
    expect(stats.topCountries).toEqual([
      { country: 'DE', clicks: 40 },
      { country: 'US', clicks: 5 },
      { country: 'CN', clicks: 2 },
    ])
  })

  it('records an unknown location without crashing', async () => {
    const response = await click(1)

    expect(response.total).toBe(1)
    expect(response.countries).toBe(0)
    expect(response.topCountries).toEqual([{ country: 'XX', clicks: 1 }])
    expect(response.topRegions).toEqual([])
    expect(response.yourCountry).toBeNull()
    expect(response.yourRegion).toBeNull()
  })

  it('rejects invalid click payloads', async () => {
    const cases = [
      { body: '{"count":0}', status: 400 },
      { body: '{"count":21}', status: 400 },
      { body: '{"count":1.5}', status: 400 },
      { body: '{"count":"3"}', status: 400 },
      { body: 'not-json', status: 400 },
      { body: '{}', status: 400 },
    ]

    for (const testCase of cases) {
      const response = await SELF.fetch(`${BASE}/api/click`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: testCase.body,
      })
      expect(response.status).toBe(testCase.status)
    }

    const wrongType = await SELF.fetch(`${BASE}/api/click`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{"count":1}',
    })
    expect(wrongType.status).toBe(415)

    const wrongMethod = await SELF.fetch(`${BASE}/api/click`)
    expect(wrongMethod.status).toBe(405)
    expect(wrongMethod.headers.get('allow')).toBe('POST')
  })
})
