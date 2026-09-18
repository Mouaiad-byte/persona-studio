# Where the money actually comes from

Written because the reel this repo started from showed `REVENUE · TODAY $1,415` and
`REVENUE · MONTH $38,580` on screen and never once showed where either number came from.
If you are going to spend months on this, spend an hour on this page first.

## 1. The reel's own business model is the reel

The video taught one step — add an image/video MCP server to Claude as a custom
connector — and spent the rest of its runtime on a dashboard that does not exist. The
most likely revenue for a creator posting that is: affiliate or sponsorship from the tool
being demoed, a paid community or course sold in the bio, and the reach itself. Note what
is *not* in that list: the content farm. **The reliable money in "here is how to run an
AI content farm" is selling the idea of running an AI content farm.** That is worth
knowing before you copy the operation instead of the pitch.

## 2. Platform payouts are the weakest of the four paths

Every major platform has moved against bulk-generated content in its monetisation terms:
programs require original content, audit for mass-produced and repetitious uploads, and
downrank reposted or unoriginal material in recommendation. A feed of generated posts is
the exact case those rules were written for.

So `platformPayoutsEligible` in `src/lib/economics.ts` defaults to **false**. If your
accounts are genuinely admitted to a program and paying, switch it on — but do not plan
the business on the assumption that they will be. Verify current terms yourself; they
change, and they differ by market.

## 3. The four paths, worst to best

| Path | Why it ranks there |
|---|---|
| **Platform payouts** | Smallest per-view number, hardest eligibility, and the one a policy change can zero overnight. Treat as a bonus, never as the model. |
| **Affiliate** | Works at low follower counts and needs no negotiation, but stacks two small fractions: views → clicks (~0.1–0.5%) and clicks → sales (~1–3%). A million views can be a few hundred dollars. |
| **Brand deals** | The biggest cheque per unit of effort, and it is a sales business with a content top-of-funnel, not a farm. Brands ask who the creator is — which is why disclosure being handled properly makes this path *possible* rather than impossible. |
| **Your own product** | You keep the margin and the customer. One guide, template pack, or tool sold to the audience a niche persona attracts beats every per-view rate above. |

Rank order of what to fix, in practice: **raise conversion on one product** before
**doubling post volume**. At a blended RPM of a couple of dollars per thousand views,
output is the expensive lever and conversion is the cheap one.

## 4. The costs people leave out

Open the Economics screen and watch two rows as you raise post volume:

- **Generation spend** scales linearly with posts. Video is the expensive one, and the
  attempts you throw away cost the same as the ones you publish.
- **Human review** scales linearly too, and it is the row that gets quietly deleted when
  people scale. Six minutes a post at 180 posts a month is 18 hours — a part-time job.
  Deleting the review gate is precisely what turns a studio into the thing that gets
  banned, so price it instead of wishing it away.

Then read **Your hour, effectively**: net plus the review cost, divided by review hours.
Compare it against what an hour of your time earns elsewhere before scaling anything.

## 5. What a workable version looks like

Fewer personas, real niches, disclosure on every surface, and one thing to sell:

1. **Two or three personas, not thirty.** Each in a niche you can actually answer
   questions about, because a brand deal or a comment thread will ask.
2. **Labelled as AI everywhere** — bio, per post, and the platform's own flag. It costs
   nothing in reach terms next to what an un-labelled synthetic account risks, and it is
   the difference between a studio and a deception.
3. **One product per persona.** The affiliate link is the test; your own product is the
   business.
4. **The review gate stays.** Every post gets human eyes before it publishes. That is the
   constraint the whole console is built around.
5. **Measure blended RPM, not views.** Views are the vanity number the reel was selling.

This is a real, small, legal business. It is not $38,580 a month, and nothing you saw in
that reel demonstrated that it was.
