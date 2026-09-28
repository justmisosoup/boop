# formation/

Offline tooling for the registration standing table, and nothing else.

- `src/data/registrationStanding.json` is the table: 922 state/status/sub-status/details
  combinations, each classified (in good standing, not published, at risk, dissolved…).
  `standingOf` in `src/lib/registrationStatus.ts` reads it for every standing decision
  on the page.
- `data/` holds what it is built from: the cleaned per-jurisdiction status breakdown,
  the cleaning log, and `review_needed.csv` (143 provisional rows awaiting a decision).
- `python3 formation/build.py` regenerates the table and applies filled review rows;
  `--no-regen` only applies the rows. Regenerating needs pandas and the raw
  `per_jurisdiction_status_breakdown.csv`, which is not in the repo.
