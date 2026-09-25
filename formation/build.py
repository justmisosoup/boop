"""Regenerate details_map.json, then apply the human decisions in review_needed.csv.

    python formation/build.py [--no-regen]

1. Runs data/build_details_map.py (it writes into its cwd, so it runs inside data/).
   It overwrites review_needed.csv, so filled your_category/your_note are saved
   first and merged back. If it cannot run (it needs pandas and the raw
   per_jurisdiction_status_breakdown.csv), the existing details_map.json is kept.
2. Every review row with your_category set overrides that entry's category and
   assessment (via _meta.assessment), attaches your_note, and clears review.
   The original values are kept under "ovr" so clearing a row later reverts it.
3. Validates: every category is in _meta.assessment and every alias target exists.
"""
import csv, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
MAP = os.path.join(DATA, 'details_map.json')
REVIEW = os.path.join(DATA, 'review_needed.csv')


def key(state, label):
    return f'{state}|{label.replace(" / ", "|")}'


def read_review(path):
    if not os.path.exists(path):
        return [], []
    with open(path, newline='', encoding='utf-8-sig') as f:
        r = csv.DictReader(f)
        return r.fieldnames or [], list(r)


def filled(rows):
    return {(r['state'], r['label']): (r.get('your_category', '').strip(), r.get('your_note', '').strip())
            for r in rows if r.get('your_category', '').strip() or r.get('your_note', '').strip()}


def regenerate():
    """Run the provided generator. Returns (ok, one-line reason)."""
    p = subprocess.run([sys.executable, 'build_details_map.py', './'], cwd=DATA,
                       capture_output=True, text=True)
    if p.returncode == 0:
        return True, 'regenerated'
    last = (p.stderr.strip().splitlines() or ['unknown error'])[-1]
    return False, f'build_details_map.py failed ({last}); kept existing details_map.json'


def merge_back(saved, old_rows):
    """Put saved your_category/your_note back into a regenerated review_needed.csv.
    Filled rows the generator no longer emits are kept, so their decision survives the next build."""
    fields, rows = read_review(REVIEW)
    seen = set()
    for r in rows:
        k = (r['state'], r['label'])
        if k in saved:
            r['your_category'], r['your_note'] = saved[k]
            seen.add(k)
    missing = [k for k in saved if k not in seen]
    rows += [r for r in old_rows if (r['state'], r['label']) in missing]
    with open(REVIEW, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        w.writeheader()
        w.writerows(rows)
    return missing


def apply_overrides(m, decisions):
    """Revert earlier overrides, then apply decisions {(state,label): (cat, note)}. Returns errors."""
    A, E, errs = m['_meta']['assessment'], m['entries'], []
    for e in E.values():
        o = e.pop('ovr', None)
        if o is not None:
            e.pop('your_note', None)
            for f, v in o.items():
                if v is None:
                    e.pop(f, None)
                else:
                    e[f] = v
    for (state, label), (cat, note) in decisions.items():
        k = key(state, label)
        e = E.get(k)
        if e is None:
            errs.append(f'review row {k}: no such entry')
            continue
        if cat and cat not in A:
            errs.append(f'review row {k}: your_category {cat!r} not in _meta.assessment')
            continue
        e['ovr'] = {'c': e['c'], 'a': e['a'], 'review': e.get('review')}
        if cat:
            e['c'], e['a'] = cat, A[cat]
            e.pop('review', None)
        if note:
            e['your_note'] = note
    return errs


def validate(m):
    A, E, errs = m['_meta']['assessment'], m['entries'], []
    for k, e in E.items():
        if e['c'] not in A:
            errs.append(f'{k}: category {e["c"]} not in _meta.assessment')
        elif e['a'] != A[e['c']]:
            errs.append(f'{k}: assessment {e["a"]} != {A[e["c"]]} for {e["c"]}')
    for k, a in m['aliases'].items():
        if a['to'] not in E:
            errs.append(f'alias {k}: target {a["to"]} missing')
    return errs


def main(argv):
    _, rows = read_review(REVIEW)
    saved = filled(rows)
    with open(MAP, 'rb') as f:
        prev = f.read()  # last valid map, restored if the new one fails validation
    if '--no-regen' in argv:
        print('regen skipped')
    else:
        ok, why = regenerate()
        print(why)
        if ok:
            for k in merge_back(saved, rows):
                print(f'warning: filled review row {key(*k)} no longer generated; kept in review_needed.csv and still applied')
    with open(MAP) as f:
        m = json.load(f)
    errs = apply_overrides(m, saved) + validate(m)
    tmp = MAP + '.tmp'
    if errs:
        with open(tmp, 'wb') as f:
            f.write(prev)
        os.replace(tmp, MAP)
        print(f'{len(errs)} validation error(s); previous details_map.json kept')
        for e in errs[:20]:
            print(' ', e)
        return 1
    with open(tmp, 'w') as f:
        json.dump(m, f, separators=(',', ':'))
    os.replace(tmp, MAP)
    decided = sum(1 for c, _ in saved.values() if c)
    left = sum(1 for e in m['entries'].values() if e.get('review'))
    print(f'ok: {len(m["entries"])} entries, {len(m["aliases"])} aliases, {decided} overrides, {left} still provisional')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
