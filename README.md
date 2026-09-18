# Persona Studio

A studio console for running a small number of **disclosed** AI personas across social
platforms: one place to hold the generation queue, the cross-platform numbers, and the
unit economics that decide whether any of it is worth doing.

It started from a reel — `pov: you have an ai content farm` — that showed a gorgeous
control-room dashboard and then taught exactly one step: add an image/video MCP server
to Claude as a custom connector. The dashboard in that reel does not exist; the
connector takes two minutes. This repository is the part that was missing, built with
the parts that get accounts banned left out on purpose.

## What it does

Three screens, all running off a `DataSource` so the console works before any account is
connected:

| Screen | What it is for |
|---|---|
| **Dashboard** | Views (7d, with a real prior-period comparison), followers, revenue by source, platform split, persona table, the open queue, top posts. |
| **Studio** | Turns a persona + format + beat into a generation brief you can hand to an image/video MCP server, shows the publish checklist that brief has to clear, and queues it. |
| **Economics** | A monthly projection you can argue with: output, rates, costs, blended RPM, review hours, breakeven, and the structural problems those inputs imply. |

## The queue

An item moves `brief → review → scheduled → published`, with `rejected` reachable from
anywhere and reworkable via `reopen`. Two rules are enforced, and enforced **on the
server** rather than in the UI — the console is a convenience, not the guard:

- **Approving requires a name.** There is no anonymous sign-off; the actor is recorded on
  the item.
- **Approving requires complete disclosure.** A persona missing a bio label, a per-post
  label, or the platform's AI flag cannot be approved at all, and the refusal names what
  is missing.

New items always start at `brief` with no sign-off, whatever the caller sends, so there is
no way to inject something pre-approved. A rejection withdraws any existing sign-off and
requires a reason — "no" without one is not reviewable later.

The rule lives once, in `shared/gate.mjs`, imported by both the console and the collector.
Two copies would drift, and the drift would end with something publishing that should not
have.

```
POST /api/queue             {personaId, brief, generator?}
POST /api/queue/transition  {id, action, actor?, reason?, scheduledFor?}
                            action: submit | approve | reject | publish | reopen
```

A refused transition returns 400 with the reason; only an unexpected failure is a 500.

## What it deliberately does not do

- **No multi-account posting automation.** `publish` marks an item published; it does not
  post anything. Publishing stays a human action, one item at a time. Bulk cross-posting
  from synthetic accounts is coordinated inauthentic behaviour under every major
  platform's rules, and it is the part of the content-farm pitch that ends in a ban wave
  rather than a payout.
- **No undisclosed personas.** `shared/gate.mjs` is the only place that decides what may
  publish, and it requires three things: an AI label in the bio, a per-post AI label, and
  the platform's own AI-content flag. A persona missing any of them cannot be approved,
  and the reason is shown rather than hidden.
- **No invented numbers.** The bundled source marks itself `isMock: true` and the UI says
  so at the top of the screen. A dashboard that cannot tell you where its figures came
  from is a prop.

## Quickstart

```bash
npm install
npm run dev        # http://localhost:5173 — runs on the bundled mock
npm test           # 105 tests, no browser and no credentials needed
npm run typecheck
npm run build
```

Then, to run on your own numbers (see `docs/data-sources.md`):

```bash
cp .env.example .env            # Google OAuth client for the YouTube collector
cp data/personas.example.json data/personas.json
npm run server                  # collector on :8787
# open http://localhost:8787/auth/google once to consent
npm run collect                 # merges today's figures into data/collected.json
```

The console prefers the collector and falls back to the mock, and says which it used.

## Layout

```
src/
  data/
    types.ts         domain model — Persona, Post, QueueItem, RevenueEntry, DataSource
    mockSource.ts    deterministic synthetic snapshot (seeded; same numbers every reload)
    httpSource.ts    reads the collector, and validates everything crossing the boundary
    queueApi.ts      queue mutations; surfaces the server's own refusal message
  lib/
    disclosure.ts    typed surface over shared/gate.mjs
    economics.ts     the projection model + the structural checks on it
    series.ts        scales, paths, period-over-period change
    format.ts        number/date formatting
  components/        stat tile, time-series chart (crosshair + tooltip), bars, tables
  features/          Dashboard, Studio, Economics
shared/
  gate.mjs           the publish gate, shared verbatim by console and collector
server/
  index.mjs          local HTTP face: snapshot, collect, queue writes, the OAuth dance
  cli.mjs            `npm run collect`
  collect.mjs        one collection run, failing per-channel rather than per-run
  snapshotService.mjs assembles the served Snapshot from disk
  google/            OAuth + thin YouTube API wrappers
  lib/               PURE and tested: response mapping, history merge, snapshot
                     assembly, queue state machine
data/                your personas, queue and revenue (gitignored; examples committed)
docs/
  openart-mcp.md     the connector setup the reel was actually teaching
  data-sources.md    wiring the collector to your own accounts
MONETIZATION.md      where the money in this actually comes from
```

The collector splits along one line: anything that interprets an API response lives in
`server/lib/` as a pure function with tests, because that is the layer where a wrong field
name silently becomes a wrong number on a dashboard. The API wrappers stay thin.

## Charts

Colour, marks and interaction follow a validated palette: three categorical slots
(blue / orange / aqua) bound to platforms so a filter never repaints them, one hue for
magnitude rows, single-series charts with no legend box, a crosshair and tooltip on
hover, and a table view behind a toggle on the views chart. Both themes are stepped for
their own surface rather than flipped. Do not add a fourth categorical slot without
re-running a palette validator against both surfaces.

## Next

The mock is the seam. `docs/data-sources.md` has the shape of a live source per platform;
implement `DataSource` and the console does not change.
