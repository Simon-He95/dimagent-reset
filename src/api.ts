import {
  MAX_CLICKS_PER_REQUEST,
  type ClickResponse,
  type CountryCount,
  type RegionCount,
  type StatsSnapshot,
} from '../shared/contract'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function fetchStats(signal?: AbortSignal): Promise<StatsSnapshot> {
  const response = await fetch('/api/stats', {
    headers: { accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new ApiError(response.status, 'stats_failed')
  return parseStatsSnapshot(await response.json())
}

export async function postClicks(count: number): Promise<ClickResponse> {
  const response = await fetch('/api/click', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ count }),
    keepalive: true,
  })
  if (!response.ok) throw new ApiError(response.status, 'click_failed')
  const value: unknown = await response.json()
  if (!isRecord(value)) throw new Error('invalid click response')
  const accepted = readCount(value.accepted)
  if (accepted > MAX_CLICKS_PER_REQUEST) throw new Error('invalid accepted count')
  return { ...parseStatsSnapshot(value), accepted }
}

export function parseStatsSnapshot(value: unknown): StatsSnapshot {
  if (!isRecord(value)) throw new Error('invalid stats response')
  return {
    total: readCount(value.total),
    today: readCount(value.today),
    last5m: readCount(value.last5m),
    countries: readCount(value.countries),
    topCountries: readCountryCounts(value.topCountries),
    topRegions: readRegionCounts(value.topRegions),
    yourCountry: readCountry(value.yourCountry, true),
    yourRegion: readNullableString(value.yourRegion, 80),
    updatedAt: readTimestamp(value.updatedAt),
  }
}

function readCountryCounts(value: unknown): CountryCount[] {
  if (!Array.isArray(value)) throw new Error('invalid countries')
  return value.slice(0, 20).map((entry) => {
    if (!isRecord(entry)) throw new Error('invalid country entry')
    return { country: readCountry(entry.country, false), clicks: readCount(entry.clicks) }
  })
}

function readRegionCounts(value: unknown): RegionCount[] {
  if (!Array.isArray(value)) throw new Error('invalid regions')
  return value.slice(0, 20).map((entry) => {
    if (!isRecord(entry)) throw new Error('invalid region entry')
    const region = readNullableString(entry.region, 80)
    if (!region) throw new Error('invalid region name')
    return {
      country: readCountry(entry.country, false),
      region,
      clicks: readCount(entry.clicks),
    }
  })
}

function readCountry(value: unknown, nullable: true): string | null
function readCountry(value: unknown, nullable: false): string
function readCountry(value: unknown, nullable: boolean): string | null {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || !/^[A-Z]{2}$/.test(value)) {
    throw new Error('invalid country')
  }
  return value
}

function readNullableString(value: unknown, maxLength: number): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || value.length > maxLength) throw new Error('invalid string')
  return value
}

function readCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error('invalid count')
  }
  return value
}

function readTimestamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('invalid timestamp')
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
