# dimagent-reset

A one-screen petition site for a DimAgent reset. Saint Tibo grants the tokens. Visitors count the requests.

**Live:** https://dim-reset.pages.dev

<p align="center">
  <img src="./src/assets/saint-tibo-640.jpg" width="300" alt="Saint Tibo, giver of tokens and reseter of limits" />
</p>

The page is a Vue 3 + Vite static app served by Cloudflare Pages. Pages Functions own the small JSON API, and click counts plus country/region totals live in Cloudflare D1.

## What it does

- A large, keyboard-accessible reset button with press physics, coin particles, a combo streak, and optional synthesized sound.
- A live total, today's count (UTC), the last 5 minutes, the number of countries, the top countries, the top region today, and the viewer's Cloudflare-provided region.
- Clicks are counted optimistically, batched to at most 20 per request, and queued in `localStorage` when the network is unavailable.
- English and Chinese copy with browser-language detection and a manual switch.
- One accent color (DimAgent green), one dark parchment theme, and a reduced-motion path that removes particles and shake.

### Layout

```text
Desktop
┌─────────────────────────────────────────────────────────────────────┐
│ [dim logo] DIMAGENT / RESET PETITION     [sound] [中文] [● LIVE]     │
├──────────────────┬────────────────────────────┬─────────────────────┤
│  ┌────────────┐  │ DIMAGENT,                  │ RESET REQUESTS      │
│  │ dim seal   │  │ RESET US.                  │ 1,723,891           │
│  │            │  │                            │ ─────────────────── │
│  │ SAINT TIBO │  │ Saint Tibo grants the      │ TODAY    42,301     │
│  │  artwork   │  │ tokens. We just count the  │ LAST 5M     321     │
│  │            │  │ requests.                  │ COUNTRIES     47    │
│  └────────────┘  │                            │ ─────────────────── │
│  SANCTVS TIBO    │ [ PRAY FOR A RESET ]       │ TOP COUNTRIES       │
│  夕阳针           │ STREAK ×12  BEST ×87       │ China      32,103   │
│                  │ YOURS 123                  │ United...  18,442   │
│                  │                            │ TOP REGION TODAY    │
├──────────────────┴────────────────────────────┴─────────────────────┤
│ YOUR SIGNAL: SHANGHAI, CN     petition note      stored-data note   │
└─────────────────────────────────────────────────────────────────────┘

Mobile
┌─────────────────────────────┐
│ [dim logo]    [sound] [中文]│
│ ┌─────────────────────────┐ │
│ │  artwork, cropped       │ │
│ │  face + RESET coin      │ │
│ └─────────────────────────┘ │
│ SANCTVS TIBO / 夕阳针        │
│ DIMAGENT,                   │
│ RESET US.                   │
│ [ PRAY FOR A RESET ]        │
│ STREAK / BEST / YOURS       │
│ RESET REQUESTS + metrics    │
│ top countries / region      │
│ footer                      │
└─────────────────────────────┘
```

## Stack

- Vue 3, Vite 6, TypeScript, hand-written CSS.
- Cloudflare Pages for the built site and Pages Functions.
- Cloudflare D1 for durable aggregates.
- Vitest with `@cloudflare/vitest-plugin` for the shared API handler and D1 integration tests.
- Self-hosted Geist and Cormorant Garamond via Fontsource.

## Local development

Requirements: Node 22+, pnpm 11+, and a Cloudflare account only when deploying.

```bash
pnpm install
pnpm run db:migrate:local
```

Run the API and the Vite dev server in two terminals:

```bash
pnpm run dev:api   # http://127.0.0.1:8787, Worker test harness + local D1
pnpm run dev       # http://127.0.0.1:5178, proxies /api to 8787
```

`worker/index.ts` is a local and test harness that calls the same `server/petition.ts` handler as production. The deployed Pages Function is the thin adapter in `functions/api/[[path]].ts`.

The local D1 database is stored under `.wrangler/` and is not committed. Local requests get a Cloudflare location from Miniflare; production uses the real `request.cf` country and region.

If pnpm blocks the `workerd` install script, run `pnpm approve-builds` once.

## Cloudflare deployment

1. Authenticate:

   ```bash
   pnpm exec wrangler login
   ```

2. Create the database:

   ```bash
   pnpm exec wrangler d1 create dim-reset
   ```

3. Copy the printed `database_id` into `wrangler.jsonc`, replacing the all-zero placeholder.

4. Apply the migration remotely:

   ```bash
   pnpm run db:migrate:remote
   ```

5. Create the Pages project once:

   ```bash
   pnpm run pages:create
   ```

6. Build and deploy:

   ```bash
   pnpm run deploy
   ```

The production URL is `https://dim-reset.pages.dev`. Add a custom domain from the Pages project's **Custom domains** settings; do not enable a `workers.dev` route for this project.

The canonical URL and Open Graph tags in `index.html` point at `https://dim-reset.pages.dev/`. Update them when you attach the final domain. The social image is `public/og-saint.jpg`.

## Data model

`migrations/0001_init.sql` creates:

| Table | Purpose | Retention |
| --- | --- | --- |
| `totals` | All-time counter | Forever |
| `country_totals` | All-time clicks by country code | Forever |
| `region_totals` | All-time clicks by country + region | Forever |
| `daily_regions` | Daily country/region series | Forever |
| `minute_regions` | Live activity for the last 5 minutes | Pruned to 15 minutes |

Each click request updates every aggregate in one transactional D1 batch and reads the new stats in the same batch. The counter never stores raw clicks, IP addresses, user agents, or cookies.

`day` is UTC (`YYYY-MM-DD`). Country and region come from `request.cf.country` and `request.cf.region`. Missing country data is stored as `XX` but excluded from the public country count and country list.

## API

`POST /api/click`

```json
{ "count": 3 }
```

`count` must be an integer from 1 to 20. The response includes `accepted` plus the same fields as the stats endpoint. JSON content type is required.

`GET /api/stats`

```json
{
  "total": 1723891,
  "today": 42301,
  "last5m": 321,
  "countries": 47,
  "topCountries": [{ "country": "CN", "clicks": 32103 }],
  "topRegions": [{ "country": "CN", "region": "Shanghai", "clicks": 12003 }],
  "yourCountry": "CN",
  "yourRegion": "Shanghai",
  "updatedAt": 1794913621026
}
```

The frontend validates every response before using it. Counts are non-negative integers, country codes are two uppercase letters, and the queue never sends more than 20 clicks in one request.

## Long-term stats

Both scripts run `scripts/report.sql`:

```bash
pnpm run stats:local
pnpm run stats:remote
```

The report prints the all-time total, today's UTC total, top countries, top regions, and the last 30 daily totals. You can also query D1 directly from the Cloudflare dashboard.

## Counting behavior

- A click updates the UI immediately.
- Clicks accumulate for 450 ms or until a batch of 20, then flush.
- A failed batch is kept in `localStorage` and retried; a 4xx response is treated as a permanent rejection and surfaced as a sync error.
- `pagehide` sends queued clicks with `navigator.sendBeacon`.
- The page polls stats every 10 seconds while visible and refreshes on visibility changes.
- Rejected/queued clicks do not block the button.

There is no bot protection or per-IP rate limit. The numbers are a community signal, not audited votes. If abuse becomes a problem, add Cloudflare Turnstile or a rate-limiting binding at the API boundary.

## Privacy

The API stores only aggregate country and region counts. It does not store IP addresses, user agents, or cookies. The browser keeps locale, sound preference, best streak, personal click count, and the unsent click queue in `localStorage`. No third-party analytics or requests are included.

## Tests

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

The API test runs inside workerd with an isolated D1 database. It covers empty stats, click persistence across every aggregate table, country ranking, historical totals, unknown locations, and invalid payloads.

## Artwork

The Saint Tibo artwork in `src/assets/` and `public/og-saint.jpg` was supplied by the project owner. Confirm the rights and likeness permissions before redistributing or publicly deploying it.
