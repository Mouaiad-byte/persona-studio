# Replacing the mock with real numbers

The console reads everything through one interface, so going live means implementing it
once and changing nothing else:

```ts
export interface DataSource {
  readonly name: string
  load(): Promise<Snapshot>
}
```

`src/data/mockSource.ts` is the reference implementation. Swap the import in
`src/App.tsx`, or select a source at runtime — the components only ever see a `Snapshot`.

**Set `isMock: false` only when every figure in the snapshot is real.** The banner the UI
shows off that flag is the one thing keeping this console honest; a half-real snapshot
that claims to be real is worse than an obviously fake one.

## Per platform

All three require a registered app, an OAuth flow, and — for anything beyond your own
account — a review process. Budget days, not hours, and check current scope names and
endpoints against the provider's docs; these move.

### Instagram

- Professional (Business or Creator) accounts only. Personal accounts have no insights API.
- Media and account insights come from the Instagram Graph API; you will want per-media
  metrics (views/plays, likes, comments, saves) and account-level follower counts.
- Insight availability and metric names differ by media type, and some metrics are only
  available for a trailing window. Backfill what you can and store it yourself — the
  30-day series the dashboard draws is your database, not theirs.

### TikTok

- The Display API covers user info and video lists; richer analytics sit behind the
  business/marketing APIs.
- Access is gated per scope and per app review. An app approved for basic profile data
  will not return view counts.

### YouTube

- Data API v3 for videos and channel metadata; the YouTube Analytics API for
  per-video and per-day metrics.
- Shorts metrics are reported alongside long-form; separate them yourself if the split
  matters to you.

## Revenue

There is no API that tells you what you earned across these paths. In practice:

- **Platform payouts** — export from each platform's monetisation dashboard.
- **Affiliate** — most networks have a reporting API or a scheduled CSV.
- **Brand deals** and **own product** — your invoices and your store. These are
  hand-entered or come from a payment processor, and they are usually the largest rows,
  which is why `RevenueEntry` carries a free-text `note`.

Attribute revenue to a **date** and a **source**, not to a post. Post-level attribution
across three platforms and a link shortener is a project of its own, and the decisions
you make from this console (raise conversion, or raise volume?) do not need it.

## Storing history

Platform APIs are thin on history and rate-limited. Poll on a schedule, write each day's
figures into your own store, and have the live `DataSource` read from that. The console
expects `viewsDaily` and `viewsByPlatform` to share dates and to be ordered oldest-first;
`tests/mockSource.test.ts` asserts exactly that, so point those tests at your source once
it exists.
