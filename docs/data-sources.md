# Replacing the mock with real numbers

The console reads everything through one interface, so going live means implementing it
once and changing nothing else:

```ts
export interface DataSource {
  readonly name: string
  load(): Promise<Snapshot>
}
```

Two are shipped. `src/data/mockSource.ts` builds a synthetic snapshot; `src/data/httpSource.ts`
reads one from the local collector in `server/`. The app prefers the collector and falls
back to the mock, and it always says which it used — the pill in the top bar, and a banner
naming the error when the fallback happened.

## The YouTube collector

YouTube is implemented because it is the least gated of the three: the owner's own
analytics need an OAuth consent, not an app review.

### 1. A Google OAuth client

At <https://console.cloud.google.com/apis/credentials>, in a project of your own:

- Enable **YouTube Data API v3** and **YouTube Analytics API**.
- Create an **OAuth client ID**, type **Web application**.
- Add the redirect URI `http://localhost:8787/auth/google/callback`.
- While the consent screen is in testing, add your own Google account as a test user.

Then `cp .env.example .env` and fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
`.env` is gitignored. Nothing here ever reaches the browser bundle: the Analytics API has
no key-only mode, so the credentials stay in the collector and the frontend talks to it
through the Vite dev proxy.

### 2. Your personas

```bash
cp data/personas.example.json data/personas.json
cp data/queue.example.json   data/queue.json
cp data/revenue.example.csv  data/revenue.csv
```

All three are gitignored — they are your accounts, not the project's. In `personas.json`,
set each YouTube account's `externalId` to the channel id (the `UC…` string from
YouTube Studio → Settings → Channel → Advanced). The collector only looks at accounts
that have one.

### 3. Authorise once, then collect

```bash
npm run server      # http://localhost:8787
# open http://localhost:8787/auth/google once, consent, close the tab
npm run collect     # prints what it collected and what it could not
npm run dev         # console now reads the collector
```

`npm run collect` is the thing to put on a schedule. The server only serves what the last
collect wrote, so a browser refresh never spends API quota.

### What it collects

| Field | From |
|---|---|
| `accounts[].followers` | Data API `channels.list` statistics (0 for a hidden subscriber count) |
| `viewsByPlatform.youtube` | Analytics API `reports.query`, `dimensions=day` |
| `posts` | Analytics `dimensions=video` for the window, joined to `videos.list` for titles |
| `revenue` (`creator_fund`) | Analytics `estimatedRevenue`, only with the monetary scope on a monetised channel |

Two honest gaps in that table. **Saves are always 0** — YouTube exposes no such metric, and
a proxy invented here would quietly corrupt every engagement rate on the dashboard. And
**payout data is optional**: when the monetary scope is absent or the channel is not
monetised, the run records a note and carries on rather than failing.

### Where history comes from

The APIs are thin on history and rate-limited, so each collect merges that day's figures
into `data/collected.json` and the console reads from there. Incoming points win on a
shared date, because platforms revise recent days for a while. Days with no row are
filled at zero — a zero-view day is a real zero, and a chart that skips those days
compresses time and flatters the trend.

## Instagram and TikTok

Not implemented, and the console says so rather than implying coverage: the Coverage row
marks each platform `live`, `stored`, or `no collector`, so a zero that means "nothing
collected" is distinguishable from a zero that means zero.

To add one, write a collector alongside `server/collect.mjs` that appends to
`collected.json` under its own platform key. What to expect:

- **Instagram** — professional (Business or Creator) accounts only; personal accounts have
  no insights API. Media and account insights come from the Instagram Graph API, metric
  names differ by media type, and some are only available for a trailing window.
- **TikTok** — the Display API covers user info and video lists; view-level analytics sit
  behind the business APIs. Access is granted per scope and per app review, so an app
  approved for profile data will not return view counts.

Both need an app review before they return anything interesting. Budget days, not hours,
and check current scope names against the provider's docs — these move.

## Revenue

There is no API that tells you what you earned across these paths, so `data/revenue.csv`
is the source of record: `date,source,amountUsd,note`, with `source` one of `brand_deal`,
`affiliate`, `creator_fund`, `own_product`. The note may contain commas. A malformed row
fails the read with its line number rather than being skipped — silently losing a brand
deal is worse than a failed parse.

Attribute revenue to a **date** and a **source**, not to a post. Post-level attribution
across three platforms and a link shortener is a project of its own, and the decisions
this console exists to inform — raise conversion, or raise volume? — do not need it.

## Writing your own source

Implement `DataSource` and return something `validateSnapshot` accepts
(`src/data/httpSource.ts`). It enforces the invariants the UI depends on: every platform
series shares the dates of `viewsDaily`, points are `YYYY-MM-DD` with finite values, and
`isMock` is stated explicitly.

**Set `isMock: false` only when every figure in the snapshot is real.** That flag drives the
banner, and it is the one thing keeping this console honest. A half-real snapshot claiming
to be real is worse than an obviously fake one — use `coverage` to say which platforms you
actually reached.
