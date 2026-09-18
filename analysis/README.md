# analysis/

The analysis is produced by the **Claude Code session**, not an API call. This file
is the spec the session writes against — it is load-bearing, not documentation.

- `pending.json` — the latest request, written when the user hits Run.
- `request-<id>.json` — kept per request, so a refinement can be read in context.
  Its `assessments` array is the **manifest**: what this run is composed of.
- `result-<id>.assessments/<assessmentId>.json` — one file per assessment. Written
  concurrently, in any order.
- `result-<id>.json` — the verdict, written **after every assessment has landed**.

## Work the assessments at the same time

The assessments are independent of each other. None of them reads another's
output, each has its own brief and its own scoped insights, and the report is
laid out by the manifest rather than by the order they finish in. So they are
**not** written one after another — that was six minutes of waiting for work that
had no reason to queue.

**Fan out. One subagent per assessment, all dispatched together.** Give each one
the shared brief in `prompt`, its own `instructions` from the manifest, and the
insights. It writes exactly one file:

```
analysis/result-<id>.assessments/<assessmentId>.json
```

```json
{
  "by": "claude-code-session",
  "assessmentId": "skill-kyb-3",
  "name": "Sanctions and PEP screening",
  "used": ["watchlist", "politically_exposed_persons"],
  "section": { "id": "skill-kyb-3", "body": [ ... ], "gaps": [ ... ] }
}
```

`assessmentId` and `section.id` must both be the manifest's id — that is how the
file is matched to the assessment that asked for it, and a mismatch is rejected
naming both. `used` is unioned across the files; `name` becomes the heading.

Each one appears on screen the moment it lands, and its own step goes green. A
slow assessment holds only its own row. The progress you watch is not a
presentation of the order you chose — it is which files exist.

Writing a file is not atomic and the UI polls every 1.2 seconds, so it **will**
sometimes read one mid-flush. That is treated as "not here yet" and waited out,
not as an error. Do not try to avoid it.

## Then, and only then, the verdict

Once **every** assessment on the manifest is on disk, read what you actually
wrote and write `result-<id>.json` — `{ headline, recommendation, followUps }`.

Two checks hold you to it:

- **A verdict with an assessment still missing is refused, naming it.** Not
  "written early" — refused. A recommendation resting on a file that is quietly
  short a section is the failure this product exists to prevent.
- **Every insight the verdict cites must already appear in an assessment**, in
  `recommendation` and in every `followUp`. A conclusion reaching past its own
  argument is a 422 naming the ids, not a rendered report. Sequence alone would
  prove little — you could write the verdict off the record and merely save it
  second. This is what makes the recommendation a reading *of* the assessments.

Read them before you decide. If the verdict you reach is not supported by the
assessments you wrote, the assessments were wrong — go back and fix them, rather
than widening the verdict's citations to fit.

## The lede is not part of this

`analysis/lede-<businessId>.json` is authored once per business and served from
`/api/lede`. It is keyed on the business, not the run, so **a re-run does not
rewrite it** — the same business reads the same way every time.

It waits on nothing and nothing waits on it. When the console asks for one, write
it alongside the assessments rather than after them. An assessment cannot reach
it, which is the point: an instruction added to one ("say HELLO at the top") used
to rewrite the first paragraph of the page.

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
they want to disagree with it.

The assessments are **the stages an account-opening file is actually built from**,
not the shape of the record we happen to hold: customer identification, beneficial
ownership and control, the nature and purpose of the account, sanctions and
screening, and adverse information and financial standing. Written in that order the
report is the file, in the sequence a reviewer works it — which is the point of
structuring it this way rather than by where the data came from.

The headline is the account-opening answer, not a summary of the record. It is
printed as the first line of `recommendation`, which the reader reaches second. Do
not repeat it in the `recommendation` prose; that paragraph earns its place by
saying what the verdict rests on.

**`question`** — a follow-up the user typed. Answer that, directly, using the same
rules. Prior turns arrive in `history`.

Attachments, when present, are listed in `attachments[]` with a `path` — read them
off disk. They are evidence, not insights: say when something comes from a document
rather than from the record.

## The shapes

One assessment — `result-<id>.assessments/<assessmentId>.json`:

```json
{
  "by": "claude-code-session",
  "assessmentId": "skill-kyb-identification",
  "name": "Customer identification",
  "used": ["name", "entity_type", "sos_domestic"],
  "section": {
    "id": "skill-kyb-identification",
    "body": [
      { "text": "What the record establishes about the entity.", "cites": ["name"] },
      { "text": "An expected filing was searched for and not found." }
    ],
    "gaps": [
      { "id": "domestic_standing", "point": "Whether it is in good standing", "why": "not_published" }
    ]
  }
}
```

The verdict — `result-<id>.json`, written once every assessment has landed:

```json
{
  "headline": "One sentence answering the question asked — printed as the first line of `recommendation`.",
  "recommendation": {
    "id": "recommendation",
    "body": [{ "text": "What the call rests on.", "cites": ["sos_domestic"] }]
  },
  "followUps": [
    { "text": "The thing that most needs doing.", "cites": ["liens"], "closes": ["lien_detail"] },
    { "text": "The next thing." }
  ]
}
```

### The sections

**The sections are the manifest.** A report contains one section per assessment
the customer composed, under that assessment's id, plus the `recommendation`.
There is no fixed list any more: the report's shape is whatever they built, in the
order they built it, so an assessment they wrote renders instead of having to be
folded into a standing heading that half fits.

The UI supplies the headings, from the assessment's `name`, and fixes the order
from the manifest — so the order they *finish* in does not matter, which is what
lets them run at once. **Omit nothing.** Every assessment on the manifest must
produce a file; one that has nothing to say says that, in prose, and the run is
refused if it never lands at all.

Two ids are the runner's and no assessment may claim them:

| `id` | What goes in it |
|---|---|
| `recommendation` | **Last, where it is reached.** Whether to onboard, and what that rests on. `headline` is printed as its first line, so the prose here must carry the argument rather than restate that sentence; `followUps` render beneath it as a bulleted list. Written after every assessment has landed. |
| `answer` | A typed follow-up, answered on its own terms. Renders with no heading, beneath the headline. |

`description` is **gone**. The lede is not a section of a run — it is authored per
business and served from `/api/lede`, and a `description` section written here
renders nowhere at all.

**Write each stage as a stage of the file, not a category of data.** The question a
stage answers is "is this part of the onboarding file complete, and what is it
missing" — so a stage that is satisfied says so, and a stage that is waiting on a
document or an order says which. That is what makes the report handable to a reviewer
as it stands. The judging still belongs to `recommendation`: a stage says what is
present and what is outstanding, not whether the outcome is acceptable.

A `question` does **not** use these. Answer it on its own terms in one section with
`"id": "answer"` — it renders with no heading, beneath the headline, which leads
because there is no recommendation for it to land in. Forcing a follow-up through six
the workflow's headings is filing, not answering.

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

**This is the lede.** Write to it.

> Kairos Physio is a boutique concierge physical therapy studio on Madison Avenue in
> NYC's Upper East Side. Founded by Dr. Joshua Gee, it blends orthopedic rehab with
> strength training in one-on-one sessions led entirely by Doctors of Physical
> Therapy, and also offers clinician-led personal training at premium pricing.

A short, plain description of what the business is. Written for someone who has never
heard of it, in the words they would use — not for a reviewer, and not against a
policy. Two or three sentences.

It leads with the **registered business identity name, in full, exactly as it appears on
the filing** — not a trading name, not a shortened form. A trading name may follow if the
business is known by a different one. Then: what kind of business it is and where, who
founded it, and what it actually sells and who for. Nothing in it is there to support a
decision; it is there so the reader knows what company they are looking at.

Plain language throughout. No compliance framing, no risk vocabulary, and nothing about
revenue models or customer funds.

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

**Name the entity as it is registered.** The entity type in the report is the one the filing
carries, not the one the `entity_type` field buckets it into. `KAIROS PHYSICAL THERAPY PLLC` is a
PLLC; the field reads `LLC` because the API's taxonomy has no narrower value, and that is the
taxonomy's granularity rather than a second account of what the business is. Write PLLC.

Do **not** file the difference as a discrepancy, a gap, or a follow-up telling anyone to go and
resolve it. There is nothing to resolve: the name is the entity's own legal name. Narrating the
field at the reader is worse than useless — they do not need the plumbing, and it reads as doubt
about a fact that is not in doubt.

**A PLLC is a licensed professional practice organised as an LLC** — a physician or clinician
practice, most often. That carries consequences a plain LLC does not, and they belong in the report
because the form itself establishes them:

- Membership is restricted by statute to individuals licensed in the profession practised, so the
  set of people who may lawfully own it is narrower than for an ordinary LLC.
- The beneficial ownership certification therefore has to evidence each member's **licence**, not
  only their identity and percentage.
- The line of work is licensed activity, which is a fact about the form and not an inference about
  the company.

This matters beyond the prose. A policy keyed on `entity_type` sees `LLC` and will never route a
professional practice down a licensed-ownership path — the only thing carrying the distinction is
the name suffix. Where the form bears on what the policy should ask for, say so in the assessment
that owns it.

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

**Keep the recommendation to one paragraph.** The assessments above carry the
evidence. Re-stating what the registries, the officer match and the website each
showed says the same thing twice, at length, in the section least able to act on it.

The paragraph has one job: say **whether to onboard**, name what is still open
**against the customer's policy**, and frame the steps that close it. The decision is
one of three — onboard, onboard subject to named conditions, or do not onboard — and
the headline states which. Sort the open items by what kind of thing each is: an
order, a document to collect from the customer, a finding to read before anyone can
weigh it, or a policy decision the bank makes about itself rather than about this
record. **Point at the assessments rather than repeat
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
