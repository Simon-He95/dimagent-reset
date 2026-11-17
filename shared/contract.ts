export const MAX_CLICKS_PER_REQUEST = 20
export const LIVE_WINDOW_MINUTES = 5
export const MINUTE_RETENTION_MINUTES = 15

export interface CountryCount {
  country: string
  clicks: number
}

export interface RegionCount {
  country: string
  region: string
  clicks: number
}

export interface StatsSnapshot {
  total: number
  today: number
  last5m: number
  countries: number
  topCountries: CountryCount[]
  topRegions: RegionCount[]
  yourCountry: string | null
  yourRegion: string | null
  updatedAt: number
}

export interface ClickResponse extends StatsSnapshot {
  accepted: number
}

export const UNKNOWN_COUNTRY = 'XX'
