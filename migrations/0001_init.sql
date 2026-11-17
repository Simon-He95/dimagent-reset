-- Long-lived aggregates. The counter page never stores raw click events, IPs,
-- or user agents. Country and region come from Cloudflare's request metadata.
CREATE TABLE IF NOT EXISTS totals (
  scope TEXT PRIMARY KEY,
  clicks INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS country_totals (
  country TEXT PRIMARY KEY,
  clicks INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS region_totals (
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (country, region)
);

-- Daily rows keep the historical series queryable without an events table.
CREATE TABLE IF NOT EXISTS daily_regions (
  day TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, country, region)
);

-- Live activity is the only short-lived table. Old rows are pruned by the API.
CREATE TABLE IF NOT EXISTS minute_regions (
  minute INTEGER NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (minute, country, region)
);

CREATE INDEX IF NOT EXISTS idx_daily_regions_day ON daily_regions (day);
CREATE INDEX IF NOT EXISTS idx_country_totals_clicks ON country_totals (clicks DESC);
CREATE INDEX IF NOT EXISTS idx_region_totals_clicks ON region_totals (clicks DESC);
CREATE INDEX IF NOT EXISTS idx_minute_regions_minute ON minute_regions (minute);
