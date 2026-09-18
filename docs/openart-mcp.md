# Wiring an image/video MCP server into Claude

This is the step the reel was actually teaching, written out. It takes about two minutes,
and it is worth being clear that this is *all* it does: it gives Claude tools that
generate images and video. It does not post anything, track anything, or produce a
dashboard.

## The setup

1. Open the **Claude desktop app** → **Settings** → **Connectors**.
2. **Add custom connector**.
3. Give it a name you will recognise in the tool list (the reel used `Content Slave`;
   `openart` is more useful when you have several).
4. Paste the server's HTTPS MCP endpoint. For OpenArt that is `https://mcp.openart.ai/mcp`
   — confirm it against <https://openart.ai/mcp> rather than trusting a screenshot,
   including this one.
5. **Continue**, then complete whatever sign-in the provider asks for.

The same connector works from claude.ai on plans that allow custom connectors; on Team
and Enterprise an admin may have to add it for the workspace.

## Before you paste a URL

Claude's own dialog says the important part: *only use connectors from developers you
trust.* A custom connector is a third-party service you are handing tool access to.

- Generation is **metered** — an OpenArt account with credits, billed per image and per
  video. Video is the expensive one by a wide margin. Put those numbers into the
  Economics screen's cost fields before you plan volume.
- Check the provider's terms on **commercial use and output ownership** for the specific
  model you generate with. They vary by model, not just by provider.
- Anything you send to a connector leaves your machine. Do not paste anything you would
  not want held by a third party.

## Using it from here

The Studio screen builds the brief. Copy it, run it in Claude with the connector enabled,
and bring the result back into the queue in `review` state. The brief already ends with
the rule that matters:

> After generating: leave it in review. A human approves before anything publishes.

## Other servers

Nothing here is OpenArt-specific — the `generator` field on a queue item is a free-form
string (`openart-mcp:flux-1.1`, `openart-mcp:kling-video`) precisely so you can run more
than one provider and compare cost per usable asset. That ratio, not cost per generation,
is the number that matters: the attempts you discard cost the same as the ones you ship.

## Getting the generated file into the queue

The console reviews the asset, not the brief, so the generated file has to land
against its queue item. Two ways, and they are the same thing underneath:

- **Attach** in the console's queue row — a file picker, one file at a time.
- **Drop it in** at `data/assets/<itemId>/` (e.g. `data/assets/q-3/frame-01.png`).
  The collector discovers whatever is in that folder, so saving straight out of
  Claude works with no upload step.

Allowed types are `.png .jpg .jpeg .webp .gif .mp4 .webm .mov`. `.svg` is
deliberately absent: it executes script when served, and the console would be
serving it from its own origin.

Until something is attached, the item cannot be submitted for review, approved,
or published — the refusal says so. That is the point: a sign-off on an item with
nothing attached is a sign-off on the brief you wrote yourself.
