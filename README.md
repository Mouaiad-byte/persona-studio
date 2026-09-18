# Hoard

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
| **Studio** | Turns a persona + format + beat into a generation brief you can hand to an image/video MCP server, and shows the publish checklist that brief has to clear. |
| **Economics** | A monthly projection you can argue with: output, rates, costs, blended RPM, review hours, breakeven, and the structural problems those inputs imply. |

## What it deliberately does not do

- **No multi-account posting automation.** Publishing is a human action here, one item at
  a time. Bulk cross-posting from synthetic accounts is coordinated inauthentic behaviour
  under every major platform's rules, and it is the part of the content-farm pitch that
  ends in a ban wave rather than a payout.
- **No undisclosed personas.** `src/lib/disclosure.ts` is the only place that decides what
  may publish, and it requires three things: an AI label in the bio, a per-post AI label,
  and the platform's own AI-content flag. A persona missing any of them is blocked in the
  queue, with the reason shown.
- **No invented numbers.** The bundled source marks itself `isMock: true` and the UI says
  so at the top of the screen. A dashboard that cannot tell you where its figures came
  from is a prop.

## Quickstart

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 34 tests, no browser needed
npm run typecheck
npm run build
```

## Layout

```
src/
  data/
    types.ts         domain model — Persona, Post, QueueItem, RevenueEntry, DataSource
    mockSource.ts    deterministic synthetic snapshot (seeded; same numbers every reload)
  lib/
    disclosure.ts    the publish gate — one function decides what may go out
    economics.ts     the projection model + the structural checks on it
    series.ts        scales, paths, period-over-period change
    format.ts        number/date formatting
  components/        stat tile, time-series chart (crosshair + tooltip), bars, tables
  features/          Dashboard, Studio, Economics
docs/
  openart-mcp.md     the connector setup the reel was actually teaching
  data-sources.md    how to replace the mock with real platform data
MONETIZATION.md      where the money in this actually comes from
```

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
