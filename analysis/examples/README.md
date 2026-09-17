# analysis/examples/

Complete reports, kept on purpose.

The assessment output the prototype produces today is good, and it is the direction
the work is heading rather than something to be replaced. Everything else in
`analysis/` is working state — `pending.json` is overwritten on every run, result
files accumulate by timestamp, and the directory gets cleared. These are copied out
of that churn so the quality bar survives the rebuild.

**They are reference, not fixtures.** Nothing reads them at runtime. They are what a
rebuilt assessments layer has to still be able to produce.

## Shape

Each example is one run, kept whole — an output without its input cannot be judged:

| File | What it is |
|---|---|
| `request.json` | the input: business, prompt, and every insight on the record with its state, reason, because and evidence |
| `assessments.json` | stage one — the lede and the four assessments, no recommendation |
| `verdict.json` | stage two — headline, recommendation, follow-ups |

The originals are `request-<id>.json`, `result-<id>.assessments.json` and
`result-<id>.json`; the ids are millisecond timestamps and are not meaningful.

## What each one is here for

**`middesk-inc/`** — 36 insights, the richest record and the most recent run. The
general reference: five sections, every insight used, five ranked follow-ups.

**`kairos-physical-therapy-pllc/`** — 33 insights, a PLLC rather than a corporation.
Kept so the reference set is not one business. A rebuild that only reproduces Middesk
Inc has proved less than it looks.

**`the-mala-market/`** — 14 insights, the thin-file case, and the only one of the four
not drawn from the richest records in the dataset. A small Tennessee LLC: one
registration, no officers pulled, no website check, watchlist the only screening that
ran. Every insight present resolved to `result`, so the absences here are
**structural** — whole checks that were never ordered — rather than checks that came
back empty.

That makes it the reference for the failure this product exists to prevent. A thin
file must read as thin, and the rebuild has to keep saying so: the report states that
only the watchlist ran and that the missing storefront check is a gap in what was
ordered rather than a fact about the company. If a rebuilt layer ever renders one of
those silences as something counting against the business, this example is where it
will show first.

**`middesk-inc-liens-plural/`** — 33 insights. Kept for a **known flaw**, not as a
target. The record carries `liens` with `because: "We found 1 Open Lien(s)"`. The
assessment wrote "Open liens were found", dropping the count, and the verdict then
inherited the plural and called them "the unsized liens" — one lien, reported as
several. Nothing was hallucinated; the count was simply lost between stages, because
stage two reads stage one's prose rather than the values underneath it. It is the
clearest evidence on disk for giving the recommendation the values of the insights its
assessments cited.
