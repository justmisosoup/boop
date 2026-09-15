# analysis/

The analysis is produced by the **Claude Code session**, not an API call. This file
is the spec the session writes against — it is load-bearing, not documentation.

- `pending.json` — the latest request, written when the user hits Run.
- `request-<id>.json` — kept per request, so a refinement can be read in context.
- `result-<id>.assessments.json` — **stage one**, written first: the lede and the
  four assessments. No recommendation.
- `result-<id>.json` — **stage two**, written after: the verdict. The endpoint
  refuses to serve it unless stage one is already on disk.

## Two stages, in that order

A report is written as **two files**, and the order is enforced rather than assumed.

1. Write `result-<id>.assessments.json` — `{ by, used, sections }` covering
   `description` and the four assessments. A `recommendation` section here is
   rejected. The UI renders these immediately, with the recommendation step still
   spinning: the reader watches the argument land before the conclusion.

   **Write it one section at a time**, rewriting the file with each new section
   appended. The thinking steps tick over from what is on disk, so writing all
   five at once shows nothing happening and then everything at once. Incremental
   writing is not decoration — it is the only reason the progress shown is real.
2. Then write `result-<id>.json` — `{ headline, recommendation, followUps }`.

Two checks hold you to it:

- Stage two alone returns nothing. Without stage one there is no report.
- **Every insight the verdict cites must already appear in an assessment**, in
  `recommendation` and in every `followUp`. A conclusion reaching past its own
  argument is a 422 naming the ids, not a rendered report. Sequence alone would
  prove little — you could write the verdict off the record and merely save it
  second. This is what makes the recommendation a reading *of* the assessments.

Write them in that order for real. Do the assessments, read what you wrote, then
decide. If the verdict you reach is not supported by the assessments you wrote,
the assessments were wrong — go back and fix them, rather than widening the
verdict's citations to fit.

## The job

The request carries **every insight on the record**, each with an `id`. Pick the ones
that answer the question. The user does not choose them — that judgement is the
product.

`kind` says which of two things you are writing:

**`report`** — the standing KYB read, fired automatically when a business is opened.
No one asked; the analyst arrived knowing why they are here. Write it for **a
financial institution opening a business bank account**.

It reads in three movements: **what the business is**, **what we think**, then
**why we think it**. The recommendation sits second, above the assessments it rests
on — an analyst wants the call before the working, and reads the assessments when
they want to disagree with it. Between them the assessments must cover whether a
legally registered entity exists and is active, whether it is actually operating,
who is behind it, and whether anything screens adversely.

The headline is the account-opening answer, not a summary of the record. It is
printed as the first line of `recommendation`, which the reader reaches second. Do
not repeat it in the `recommendation` prose; that paragraph earns its place by
saying what the verdict rests on.

**`question`** — a follow-up the user typed. Answer that, directly, using the same
rules. Prior turns arrive in `history`.

Attachments, when present, are listed in `attachments[]` with a `path` — read them
off disk. They are evidence, not insights: say when something comes from a document
rather than from the record.

## The result shape

```json
{
  "by": "claude-code-session",
  "used": ["name", "sos_domestic", "location_frequency:moderate"],
  "headline": "One sentence answering the question asked — printed as the first line of `recommendation`.",
  "sections": [
    {
      "id": "description",
      "body": [{ "text": "What this business is, in plain terms.", "cites": ["name"] }]
    },
    {
      "id": "identity",
      "body": [
        { "text": "What the record establishes about the entity." },
        { "text": "An expected filing was searched for and not found." }
      ],
      "gaps": [{ "point": "Whether it is in good standing", "why": "not_published" }]
    }
  ],
  "followUps": [
    { "text": "The thing that most needs doing.", "cites": ["liens"] },
    { "text": "The next thing." }
  ]
}
```

### The six sections

A `report` is written as the same six sections every time, so two businesses can be
read against each other and an analyst knows where to look. Write them under these
ids; the UI supplies the headings and fixes the order — description, recommendation,
then the four assessments — so the order you write them in does not matter. **Omit a section you have nothing for** — an empty one is worse
than none.

| `id` | What goes in it |
|---|---|
| `description` | **The lede.** Renders with no heading, above everything. **What the business does or is — nothing else.** Line of work, who it serves, roughly how big, how long it has been going. See the ban list below. |
| `recommendation` | **Second, above the assessments.** The decision and what it rests on. `headline` is printed as its first line, so the prose here must carry the argument rather than restate that sentence; `followUps` render beneath it as a bulleted list. |
| `identity` | Does a legally registered entity exist, is it active, and is the submitted identity the same one as the registered one. |
| `ownership` | Who is behind it, and whether that can be established at all. Officers, control persons, submitted people, and what the record cannot reach. |
| `activity` | Whether it is actually operating — address, website, connections, the shape of the footprint. |
| `compliance` | Watchlist, PEP, adverse media, liens, litigation, bankruptcy, industry. |

A `question` does **not** use these. Answer it on its own terms in one section with
`"id": "answer"` — it renders with no heading, beneath the headline, which leads
because there is no recommendation for it to land in. Forcing a follow-up through six
standing headings is filing, not answering.

`used` ids must round-trip **exactly**, including the `location_frequency:<band>`
fan-out. An id that matches no row is dropped from the sources roll-up and reported
on screen — it will not pass silently.

## Rules

**An established absence is `body`, not `gaps`.** "We searched the DBA filings and
found no match" is something the record establishes. Filing it as a gap would render
the one thing counting against the business as missing data.

**Nothing in an assessment is marked or highlighted** — not even that finding. It is
stated as plainly as everything around it. Open liens set in red, with a warning
glyph, read as the thing to act on, and they are not: what to act on is the
recommendation. If a finding matters to the decision, the recommendation says so in
words and a follow-up names what to do about it. That is the only place in the report
meant to read as actionable.

**`gaps` is for genuinely open questions**, with `why`. Put each one in the section
it belongs to — an ownership gap under `ownership` — so it sits beside the finding it
undercuts rather than in a pile at the end:

| `why` | Means | Whose limit |
|---|---|---|
| `not_published` | The source does not publish it | The source's |
| `not_held_or_unreachable` | It exists; we do not hold it | **Ours** |
| `not_required` | Does not apply to this kind of business | Nobody's |
| `no_insight_covers_it` | Nothing in the catalog speaks to it | The catalog's — set `wouldAnswer` |

**Do not judge outside `recommendation`.** The insight rows are careful never to say
whether something is good or bad — "shared with 21–100 businesses", never "high-risk
address". A line in `identity` or `activity` reading "this business is legitimate"
breaks that in the place a reader trusts most. The four middle sections state what
the record shows and what it means for a business of this kind; the decision itself
belongs in the headline and the `recommendation` section, against the question that
was asked.

**Absence is not a finding.** Three of the four reasons above are gaps in our data or
facts about the world. Never treat them as evidence against the business.

**The lede describes the business, not the file.** It answers "what is this
company?" for someone who has never heard of it, so that everything below has
something to be about. It is not a summary of the record and not a preview of the
assessments. Keep it to two or three sentences.

**Write it for a compliance analyst.** They are deciding whether to open an account,
and the lede exists so the rest of the file means something to someone who has never
heard of this company. Say what it does, who pays it, and how it makes money. If the
business model bears on the decision — it lends, it holds customer funds, it operates
in a licensed activity — say so; that is the most useful sentence in the paragraph.

Two failures to avoid, both of which have happened:

- **No press-release trivia.** Headcount, funding rounds, investors, accelerator
  batches, customer logos. None of it is evidence and none of it is actionable — an
  analyst does not approve an account because Sequoia backed it.
- **No asides to the reader.** No "worth naming plainly", no remarks about the report
  itself or about the irony of the record. Write reference prose in the third person,
  the way a credit memo is written. The internal voice this prototype was drafted in
  is not the voice the audience reads in.

Nothing from this list belongs in it — each of these is an assessment input and has a
section of its own:

- How many states it is registered in, or the status of any registration
- Filing types on the record — sales tax permits, Form 5500, liens, SAM entries
- Anything about an address beyond the city it works from — no deliverability,
  property type, or how many businesses share it
- Domain registration dates, website reachability, or any "matches what was submitted"
- **Entity type, state of formation, and formation date** — the page header sits
  directly above the lede and already shows all three. Repeating them wastes the
  only paragraph a reader is guaranteed to read.

Industry classification is record data too — leave it out. If the line of work
matters (it does), say it in plain words, the way someone who works there would
describe the company.

**The lede may use what you know; nothing else may.** `description` is the one
section allowed to draw on public knowledge of the company — what it sells, who it
serves, how big it is, who backs it — because a reader who does not know what the
business *does* cannot judge whether anything below is normal for it.

Every such paragraph carries `sources`: one `{ "title", "url" }` per page, rendered
as a single "Public sources" chip that opens them. **No links, no claim** — if you
cannot point at a page, you do not know it, you are recalling it, and this is the
product where that distinction is the entire point. Search and confirm rather than
writing from memory. Three rules hold absolutely:

- Outside knowledge **never substitutes for a check**. "It is a well-known company"
  is not evidence of anything and must never appear in an assessment or soften a gap.
- If public knowledge and the record **disagree**, that is a finding for `identity`,
  not something to smooth over in the lede.
- Nothing outside the lede may carry `sources`. An assessment cites insights, or it
  says nothing.

**Do not invent facts.** Everywhere else, work only from the insights in the request. If something the
question asked about is not covered, that is a `no_insight_covers_it` entry naming the
check that would answer it — not a guess.

**`pinned` must be addressed.** Ids in `pinned` were added by the user by hand. Use
them, and say what they contribute — including "it does not change the answer", which
is a legitimate finding. Silently ignoring one is the failure mode.

**Read the insights together.** The value is in what they mean in combination for
*this kind of business*, not restated one by one. A residential address is ordinary
for a sole proprietor; a registered-agent address is ordinary for a Delaware
corporation.

**Keep the recommendation to one paragraph.** The four assessments below carry the
evidence. Re-stating what the registries, the officer match and the website each
showed says the same thing twice, at length, in the section least able to act on it.

The paragraph has one job: name what is still open **against the customer's policy**,
and frame the steps that close it. **Point at the assessments rather than repeat
them** — "the unsized liens in Compliance" tells a reader where to look and costs six
words; re-arguing the finding costs four sentences and adds nothing they cannot
already see. Say what kind of thing each open item is: an order, a decision about
what the policy will accept, a request to the customer. If nothing is open, say so in
a sentence and stop.

**`followUps` are ranked, not grouped.** One list, ordered by what most needs doing
— the item that unblocks the decision first, the nice-to-have last. Do not sort them
into things-to-do and things-to-order: the analyst wants to know what to do next, and
whether that happens to be an order or a judgement call is incidental. It is the only
part of the report written as a list, because it is the only part that genuinely is
one.

**Every gap gets a step, or a reason it does not.** If a check ran at all, the
policy probably requires it — so a gap left out of the follow-ups is an omission,
not a judgement. Give each gap an `id`, and either close it with a follow-up
(`"closes": ["<gap id>"]`) or write it off on the gap itself
(`"noAction": "why it needs none"`), which renders on screen. The endpoint rejects a
verdict that leaves one unaccounted for, naming it.

Writing one off is legitimate — a customer-supplied profile the website already
corroborates needs nothing. Forgetting one is not, and the two are indistinguishable
without this.

**One sentence per follow-up.** They are steps for closing a file against a policy,
not paragraphs. The reasoning behind a step lives in the assessment it came from.

**Write a report, not a list of outputs.** Each entry in `body` and `gaps` is a
**paragraph of an argument** — two or three sentences that say what was found, what
it means for this business, and why it matters to the decision. One-line atoms
("Address is deliverable.") restate the insight rows the reader can already see and
make the analysis read as a checklist. One or two substantial paragraphs per section
beat six fragments. The sections carry the structure now, so the prose does not have
to announce it: do not open a paragraph with "For identity," — the heading said that.

**Cite inline.** Put the insight ids behind a paragraph in its `cites` array; they
render as a source chip at the end of that paragraph. Cite the ones that paragraph
actually rests on, not everything adjacent. The message-level roll-up is derived
separately from `used`.

## Writing one

The Vite console prints the exact path on each request:

```
▶ analysis requested — Kairos Physical Therapy PLLC
  15 insights
  read  prototype/analysis/pending.json
  write prototype/analysis/result-1789403052207.json
```
