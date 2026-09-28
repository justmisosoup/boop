# prototype

A Vite + React 19 + TypeScript prototype of the Middesk business-identity
assessment: the businesses list (`/businesses`) and the assessment record it opens
(`/businesses/:id`). Working rules are in `CLAUDE.md`; read it first.

```bash
bun install
bun run vite    # http://localhost:3000
```

`bun run dev` and `bun run build` pull fresh records from the live API first; run
them only when a data refresh is the point. `bunx vite build` is the build check.

## Where things live

| What | Where | Written by |
|---|---|---|
| The ingested businesses | `src/data/records.json` | `bun run pull` |
| The insight catalog | `src/data/catalog.json` | `bun run data`, from `../catalog/` |
| City registrations, licences | `src/data/cityRegistrations.json`, `licenses.json` | by hand / `scripts/pull-city-registrations.ts` |
| Registration standing table | `src/data/registrationStanding.json` | `formation/build.py` |
| Assessments (briefs, weights, insight scopes) | `analysis/agent.json` | the app's assessment editor |
| One report per business | `analysis/reports.json` | a Claude Code session, via `/api/analyse` |
| How a report is written | `analysis/README.md` | — |
| Insights, standing, scoring, card copy | `src/lib/` | — |
| The design system | `src/core/` | read-only clone — see `PARITY.md` |
