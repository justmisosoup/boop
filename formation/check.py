"""Formation verdict for one Middesk business.

    python formation/check.py <business_id> [--refresh]
    python formation/check.py <business_id> --raw registrations.officers

Prints only the verdict (max ~15 lines). 404 prints nothing. Other failures print
one line: ERROR <status> <reason>. Categories come from data/details_map.json and
are never reclassified here; the only runtime change is CERT_UPGRADE.
"""
import argparse, http.client, json, os, re, sys, time, urllib.error, urllib.request
from datetime import date, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(ROOT, '.cache')
UUID = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
CTRL = re.compile(r'[\x00-\x1f\x7f-\x9f\u2028\u2029]')  # API text must not break or spoof lines
RANK = {'CLEAR': 0, 'NOTE': 1, 'REVIEW': 2, 'CONCERN': 3}
WORDS = {'DELINQUENT': 'delinquent', 'AT_RISK': 'at risk', 'SUSPENDED': 'suspended', 'SUCCEEDED': 'succeeded',
         'TERMINATED_INVOLUNTARY': 'terminated (involuntary)', 'TERMINATED_VOLUNTARY': 'terminated (voluntary)',
         'TERMINATED_UNSPECIFIED': 'terminated', 'NOT_FORMED': 'not formed'}
_cache = {}


def load(name):
    if name not in _cache:
        with open(os.path.join(HERE, name)) as f:
            _cache[name] = json.load(f)
    return _cache[name]


def rules():
    return load('rules.json')


def dmap():
    return load(os.path.join('data', 'details_map.json'))


# ---------- fetch + cache ----------

class FetchError(Exception):
    pass


def env(var):
    if os.environ.get(var):
        return os.environ[var]
    for fn in rules()['api']['env_files']:
        path = os.path.join(ROOT, fn)
        if not os.path.exists(path):
            continue
        with open(path) as f:
            for line in f:
                m = re.match(r'\s*(?:export\s+)?' + re.escape(var) + r'\s*=\s*(.*)$', line)
                if not m:
                    continue
                v = m.group(1).strip()
                if v and v[0] in '"\'' and v[0] in v[1:]:
                    return v[1:v.index(v[0], 1)]
                return re.split(r'\s+#', v, maxsplit=1)[0].strip()
    return None


def fetch(bid, refresh=False):
    """Returns the payload, None on 404; raises FetchError(one-line reason) otherwise."""
    api = rules()['api']
    path = os.path.join(CACHE, f'{bid.lower()}.json')
    if not refresh and os.path.exists(path) and time.time() - os.path.getmtime(path) < api['cache_hours'] * 3600:
        try:
            with open(path) as f:
                cached = json.load(f)
            if isinstance(cached, dict):
                return cached
        except (OSError, ValueError):
            pass  # unreadable or corrupt cache: treat as a miss and refetch
    key = (env(api['key_var']) or '').strip()
    if not key:
        raise FetchError(f'ERROR no-key {api["key_var"]} not set')
    if re.search(r'[\x00-\x1f\x7f]', key):
        raise FetchError(f'ERROR config {api["key_var"]} contains control characters')
    base = (env(api['url_var']) or api['base_url_default']).rstrip('/')
    try:
        req = urllib.request.Request(base + api['path'].format(id=bid), headers={
            'Authorization': f'Bearer {key}', 'Accept': 'application/json', 'User-Agent': api['user_agent']})
    except ValueError:
        raise FetchError(f'ERROR config {api["url_var"]} is not a valid URL')
    try:
        with urllib.request.urlopen(req, timeout=api['timeout_s']) as r:
            body = r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise FetchError(f'ERROR {e.code} {e.reason}')
    except urllib.error.URLError as e:
        raise FetchError(f'ERROR network {e.reason}')
    except TimeoutError:
        raise FetchError('ERROR timeout after %ss' % api['timeout_s'])
    except (OSError, http.client.HTTPException, ValueError) as e:
        raise FetchError(f'ERROR network {type(e).__name__}')  # never str(e): it can echo headers
    try:
        payload = json.loads(body)
    except ValueError:
        raise FetchError('ERROR 200 response was not JSON')
    if not isinstance(payload, dict):
        raise FetchError('ERROR 200 response was not a JSON object')
    try:
        os.makedirs(CACHE, exist_ok=True)
        tmp = path + '.tmp'
        with open(tmp, 'wb') as f:
            f.write(body)
        os.replace(tmp, path)
    except OSError as e:
        print(f'WARN cache not written: {e.strerror}', file=sys.stderr)
    return payload


def raw_slice(payload, dotted):
    def step(v, part):
        if isinstance(v, list):
            return [step(x, part) for x in v]
        return v.get(part) if isinstance(v, dict) else None
    v = payload
    for part in dotted.split('.'):
        v = step(v, part)
    return v


# ---------- helpers ----------

def day(s):
    try:
        return datetime.strptime((s or '')[:10], '%Y-%m-%d').date()
    except ValueError:
        return None


def norm_name(s, drop_suffix=False):
    """casefold, drop . , ' (so L.L.C. = llc, D.D.S. = dds), other punctuation → space, normalize suffix."""
    s = re.sub(r"[.,'’]", '', (s or '').casefold())
    s = ' '.join(re.sub(r'[^\w\s]|_', ' ', s).split())
    suf, tail = rules()['name_suffixes'], []
    while True:  # peel every trailing suffix: "Co., Inc." → co inc
        for phrase in sorted(suf, key=len, reverse=True):
            if s == phrase or s.endswith(' ' + phrase):
                s = s[:-len(phrase)].strip()
                tail.insert(0, suf[phrase])
                break
        else:
            break
    return s if drop_suffix else ' '.join([s] + tail).strip()


def norm_type(s):
    if not s:
        return None
    t = ' '.join(s.upper().replace('_', ' ').split())
    return rules()['entity_type_map'].get(t) or rules()['entity_type_map'].get(t.replace('.', ''))


def doc_type(d):
    return ' '.join((d.get('document_type') or '').replace('_', ' ').casefold().split())


def low_conf(d):
    c = (d.get('metadata') or {}).get('confidence', d.get('confidence'))
    if isinstance(c, dict):
        c = min((v for v in c.values() if isinstance(v, (int, float))), default=None)
    return isinstance(c, (int, float)) and c < rules()['documents']['min_confidence']


def short_n(n):
    return f'{n / 1e6:.1f}M' if n >= 1e6 else f'{n / 1e3:.1f}K' if n >= 1e3 else str(n)


def label(reg):
    sub = reg.get('sub_status') or '(none)'
    return f'{(reg.get("status") or "").upper() or "(none)"} / {sub} / "{reg.get("status_details") or "(none)"}"'


def lookup(reg):
    M = dmap()
    parts = [reg.get('state') or '(none)', (reg.get('status') or '').upper() or '(none)',
             (reg.get('sub_status') or '').upper() or '(none)', reg.get('status_details') or '(none)']
    raw = '|'.join(parts)
    out = {'raw': raw, 'key': raw, 'flags': [], 'alias': None, 'e': None}
    a = M['aliases'].get(raw)
    if a:
        out.update(key=a['to'], alias=a)
        out['flags'] += a.get('flags', [])
    e = M['entries'].get(out['key'])
    if e is None:
        out.update(c='UNRESOLVED', a=M['_meta']['assessment']['UNRESOLVED'])
        out['flags'].append('UNSEEN_STATUS')
    else:
        out.update(c=e['c'], a=e['a'], e=e)
        out['flags'] += e.get('flags', [])
    return out


def add(flags, *fs):
    for f in fs:
        if f not in flags:
            flags.append(f)


# ---------- evaluation ----------

def evaluate(p, today=None):
    today = today or date.today()
    R, M = rules(), dmap()
    A = M['_meta']['assessment']
    flags, ctx = [], []
    soi = (p.get('formation') or {}).get('formation_state')
    regs = p.get('registrations') or []
    jur = lambda r: (r.get('jurisdiction') or '').upper()
    base = lambda r: (r.get('file_number') or '').split('-')[0]
    # a DOMESTIC row with a same-state FOREIGN row of the same base number is that
    # filing's twin (Utah lists Checkr as 12328450-0142 and -0143), not a formation
    twin_of = lambda r: next((f for f in regs if jur(f) == 'FOREIGN' and f.get('state') == r.get('state')
                              and base(f) and base(f) == base(r)), None)
    domestic = sorted([r for r in regs if jur(r) == 'DOMESTIC'], key=lambda r: r.get('registration_date') or '', reverse=True)
    twins = [(r, twin_of(r)) for r in domestic if twin_of(r)]
    cands = [r for r in domestic if not twin_of(r)]
    # only filings under the business's own name compete, when any do: Alliance Transfer's
    # active ALLIANCE ENTERPRISES IV, INC. is a related corporation, not its history
    own_name = norm_name(p.get('name') or (p.get('submitted') or {}).get('name'), True)
    named = [r for r in cands if norm_name(r.get('name'), True) == own_name]
    related = [r for r in cands if named and r not in named]
    cands = named or cands
    n_foreign = sum(1 for r in regs if jur(r) == 'FOREIGN')
    # an active DOMESTIC filing in the formation state wins; otherwise the most recent DOMESTIC filing, any state
    reg = next((r for r in cands if soi and r.get('state') == soi and (r.get('status') or '').lower() == 'active'), None)
    why = 'active in the formation state' if reg else 'most recent'
    reg = reg or (cands[0] if cands else None)
    # the original formation is kept: the filing the formation names, by state and date
    fdate = (p.get('formation') or {}).get('formation_date')
    orig = next((r for r in cands if r.get('state') == soi and r.get('registration_date') == fdate), None) \
        or next((r for r in cands if r.get('state') == soi), None)
    split = reg is not None and orig is not None and orig is not reg  # the formation is not the filing assessed
    moved = split and orig.get('state') != reg.get('state')
    look = lookup(reg) if reg else None
    others = [(r, lookup(r)) for r in cands if r is not reg and not (split and r is orig)]

    # 1-2. formation + lookup
    if reg is None:
        cat, ass, provisional = 'UNRESOLVED', A['UNRESOLVED'], False
        add(flags, 'NO_DOMESTIC_FILING')
    else:
        cat, ass = look['c'], look['a']
        provisional = bool(look['e'] and look['e'].get('review'))
        add(flags, *look['flags'])
        if moved:
            add(flags, 'FORMATION_MOVED')
            ctx.append(f'formed in {soi}; its domestic filing is now in {reg.get("state")}'
                       + (f' (the {soi} filing converted out)' if 'convert' in (orig.get('status_details') or '').lower() else ''))
        if others:
            add(flags, 'MULTIPLE_DOMESTIC')
            if any('UNSEEN_STATUS' in l['flags'] for _, l in others):
                add(flags, 'UNSEEN_STATUS')
            ctx.append(f'{len(cands)} domestic filings; using #{reg.get("file_number") or "?"} ({why})')
    single = reg is not None and not others
    home = reg.get('state') if reg else soi  # the state whose certificate counts as in-state

    # 3. entity type (submitted vs registration)
    sub_raw = (p.get('submitted') or {}).get('entity_type')
    reg_type = (reg or {}).get('entity_type')
    type_ok = None
    if reg is None:
        type_s = 'type –'
    elif not sub_raw:
        type_s = 'type – (not submitted)'
    elif norm_type(sub_raw) is None:
        type_s = f'type ? (unmapped "{sub_raw}")'
        add(flags, 'UNMAPPED_ENTITY_TYPE')
    elif norm_type(sub_raw) == 'UNKNOWN':
        type_s = 'type – (submitted UNKNOWN)'
    elif not reg_type or reg_type.upper() == 'UNKNOWN':
        type_s = f'type ? (registry {reg_type or "blank"})'
    elif norm_type(reg_type) is None:
        type_s = f'type ? (unmapped registry "{reg_type}")'
        add(flags, 'UNMAPPED_ENTITY_TYPE')
    else:
        type_ok = norm_type(sub_raw) == norm_type(reg_type)
        type_s = 'type ✓' if type_ok else f'type ✗ ({norm_type(sub_raw)} vs {reg_type})'
        if not type_ok:
            add(flags, 'ENTITY_TYPE_MISMATCH')

    # 4. articles + submitted name
    docs = p.get('documents') or []
    D = R['documents']
    if reg is None:
        name_s = 'name –'
    else:
        sn = (p.get('submitted') or {}).get('name')
        if not sn:
            name_s = 'name –'
        elif not norm_name(reg.get('name')):
            name_s = 'name ? (registry blank)'
        elif norm_name(sn) == norm_name(reg.get('name')):
            name_s = 'name ✓'
        elif norm_name(sn, True) == norm_name(reg.get('name'), True):
            name_s = 'name ✓ (suffix differs)'
        else:
            name_s = f'name ✗ ("{sn}" vs "{reg.get("name")}")'
            add(flags, 'NAME_MISMATCH')
    arts = [d for d in docs if reg and (d.get('source') or {}).get('type') == 'registration'
            and (d.get('source') or {}).get('id') == reg.get('id') and doc_type(d) in D['formation_types']]
    date_s = 'date –'
    if arts:
        usable = [a for a in arts if not low_conf(a)]
        if len(usable) < len(arts):
            add(flags, 'LOW_CONFIDENCE')
        rd = day(reg.get('registration_date'))
        dated = [a for a in usable if day(a.get('filing_date'))]
        if not usable:
            date_s = 'date ? (low confidence)'
        elif dated and rd:
            bad = [a for a in dated if day(a['filing_date']) != rd]
            if not bad:
                date_s = 'date ✓'
            else:
                date_s = f'date ✗ (articles {bad[0]["filing_date"][:10]})'
                add(flags, 'FILING_DATE_MISMATCH')

    # 5. certificate
    certs = sorted([d for d in docs if doc_type(d) in D['certificate_types']],
                   key=lambda d: d.get('filing_date') or '', reverse=True)
    cert_s = 'none'
    if certs:
        cst = lambda d: ((d.get('source') or {}).get('metadata') or {}).get('state')
        stated = lambda d: d.get('standing_status') or (d.get('metadata') or {}).get('standing_status')
        age_of = lambda d: (today - day(d.get('filing_date'))).days if day(d.get('filing_date')) else None

        def age_str(d):
            a = age_of(d)
            return 'undated' if a is None else f'dated {d["filing_date"][:10]} (future)' if a < 0 else f'{a}d old'
        instate = [d for d in certs if home and cst(d) == home]
        foreign = [d for d in certs if cst(d) and cst(d) != home]
        dom_states = {r.get('state') for r in domestic}
        kind = lambda d: 'certificate for another domestic filing' if cst(d) in dom_states else 'foreign qualification'
        usable = [d for d in instate if not low_conf(d)]
        if len(usable) < len(instate):
            add(flags, 'LOW_CONFIDENCE')
        if usable:
            c = next((d for d in usable if stated(d)), usable[0])  # newest that states its standing
            age = age_of(c)
            if age is not None and age < 0:
                add(flags, 'CERT_DATE_ANOMALY')
            verb = stated(c)
            if verb:
                good = str(verb).casefold().strip() in R['standing']['good']
                st_s = f'"{verb}" → {"good" if good else "not good"}'
                if not good:
                    add(flags, 'CERT_NOT_GOOD')
            else:
                good = D['cert_type_only_counts_as_good']
                st_s = 'standing not stated'
            cert_s = f'{home} in-state, {age_str(c)}, {st_s}'
            eligible = single and cat in ('NOT_PUBLISHED', 'UNRESOLVED')
            if good and eligible and age is not None and 0 <= age <= D['cert_max_age_days']:
                cat, ass, provisional = 'IN_GOOD_STANDING', A['IN_GOOD_STANDING'], False
                add(flags, 'CERT_UPGRADE')
                cert_s += ' → upgrade'
            elif eligible:
                cert_s += ' → no upgrade'
        elif instate:
            cert_s = f'{home} in-state, {age_str(instate[0])}; low confidence, ignored'
        elif foreign:
            cert_s = f'{cst(foreign[0])} {kind(foreign[0])}, {age_str(foreign[0])}; not formation evidence'
        else:
            add(flags, 'CERT_STATE_UNKNOWN')
            cert_s = f'issuing state unknown, {age_str(certs[0])}; not used as formation evidence'
        if instate and foreign:
            cert_s += f'; +{cst(foreign[0])} {kind(foreign[0])}, {age_str(foreign[0])}'

    # review tasks: shown, never used for the verdict
    T = {t.get('key'): t for t in ((p.get('review') or {}).get('tasks') or [])}
    tl, disagree = [], []
    for k in R['tasks']['status'] + [R['tasks']['type']]:
        t = T.get(k)
        name = R['tasks']['labels'][k]
        if t is None:
            continue
        if k == R['tasks']['type'] and reg is None:
            tl.append(f'{name} suppressed')
            continue
        st = t.get('status')
        tl.append(f'{name} {st}' + (f' ({t.get("sub_label")})' if st != 'success' and t.get('sub_label') else ''))
        if k == R['tasks']['type']:
            if (st == 'failure' and type_ok is True) or (st == 'success' and type_ok is False):
                disagree.append(name)
        elif (st == 'failure' and ass == 'CLEAR') or (st == 'success' and ass == 'CONCERN'):
            disagree.append(name)
    # say which filing a sos_domestic "Domestic <Status>" label actually matches, when it isn't ours
    sd = (T.get('sos_domestic') or {}).get('sub_label') or ''
    said = sd[len('Domestic '):].strip().lower() if sd.startswith('Domestic ') else ''
    if reg is not None and said in ('active', 'inactive', 'unknown') and said != (reg.get('status') or '').lower():
        hits = [r for r in domestic if r is not reg and (r.get('status') or '').lower() == said]
        if hits:
            h = hits[0]
            ctx.append(f'sos_domestic "{sd}" matches {h.get("state")} DOMESTIC #{h.get("file_number")} '
                       f'({said}, {h.get("status_details") or "no details"}), not the {reg.get("state")} filing used')
    tasks_s = ' · '.join(tl) or 'none'
    if disagree:
        add(flags, 'TASK_DISAGREES')
        tasks_s += f' → TASK_DISAGREES ({", ".join(disagree)})'

    # 6. officers / filers
    people_s = filer_s = None
    if reg is not None:
        pats = [re.compile(r'\b(?:' + x + r')\b', re.I) for x in R['filers']]
        is_filer = lambda n: any(r.search(n or '') for r in pats)
        roles = {}  # one entry per name, roles merged in order
        for o in reg.get('officers') or []:
            rs = roles.setdefault(o.get('name') or '?', [])
            rs += [r for r in o.get('roles') or [] if r not in rs]
        fmt = lambda n: n + (f' ({", ".join(roles[n])})' if roles[n] else '')
        kept = [fmt(n) for n in roles if not is_filer(n)]
        filers = [fmt(n) for n in roles if is_filer(n)]
        agent = (reg.get('registered_agent') or {}).get('name')
        people_s = ', '.join(kept[:4]) + (f' +{len(kept) - 4}' if len(kept) > 4 else '') if kept else 'none on filing'
        if filers or agent:
            filer_s = ', '.join(filers) or 'none'
            if agent:
                filer_s += f' · agent {agent}'

    # 7. date anomaly
    if look and look['e']:
        e, yr = look['e'], look['e'].get('yr') or [None, None]
        ry = day(reg.get('registration_date'))
        if ry and {'RETIRED', 'NEW'} & set(e.get('flags', [])) and None not in yr and not yr[0] <= ry.year <= yr[1]:
            add(flags, 'DATE_ANOMALY')
            ctx.append(f'registered {ry.year}, outside {yr[0]}–{yr[1]} for this label')

    # 8. context, merged findings
    if reg is not None:
        e = look['e'] or {}
        merged = look['key'].split('|')[1] == 'ACTIVE' and look['c'] in WORDS
        if merged:
            ctx.insert(0, f'active but {WORDS[look["c"]]}: {reg.get("status_details") or "(none)"}')
        if e.get('note') and not (merged and e['note'].startswith('active')):
            ctx.append(e['note'])
        if e.get('your_note'):
            ctx.append(f'reviewer: {e["your_note"]}')
        if look['alias'] and look['alias'].get('note'):
            ctx.append(look['alias']['note'])
        if e:
            ctx.append(f'{"uncommon: " if not e.get("normal") else ""}{short_n(e["n"])} {reg["state"]} filings carry this label ({e["pct"]:.1f}%)')

    oth = [f'{r.get("state")} DOMESTIC #{r.get("file_number") or "?"} {l["c"]}'
           + (' PROVISIONAL' if (l['e'] or {}).get('review') else '') for r, l in others]
    oth += [f'{r.get("state")} DOMESTIC #{r.get("file_number") or "?"} (related, different name: {r.get("name")})' for r in related]
    oth += [f'{r.get("state")} DOMESTIC #{r.get("file_number") or "?"} (twin of FOREIGN #{t.get("file_number")}, '
            f'{(t.get("status") or "?").lower()}; not a formation)' for r, t in twins]
    if n_foreign:
        oth.append(f'{n_foreign} FOREIGN')

    # output
    head = f'{ass} · {cat}' + (' PROVISIONAL' if provisional else '')
    desc = lambda r: (f'{r.get("state")} DOMESTIC #{r.get("file_number") or "?"}  {r.get("registration_date") or "undated"}  '
                      f'{r.get("entity_type") or "?"}  {label(r)}')
    now = None
    if reg is None:
        form = f'none in {soi or "unknown formation state"}'
    else:
        cur = desc(reg) + (f'  (read as {look["key"].split("|", 1)[1].replace("|", " / ")})' if look['alias'] else '')
        # the original formation stays the formation; the filing the verdict reads is shown under it
        form, now = (desc(orig), cur + '  ← assessed') if split else (cur, None)
    lines = [('ASSESSMENT', head), ('BUSINESS', p.get('name') or (p.get('submitted') or {}).get('name') or '?'),
             ('FORMATION', form)] + ([('NOW', now)] if now else []) + [
             ('TASKS', tasks_s), ('MATCH', f'{name_s}  {date_s}  {type_s}'), ('CERT', cert_s)]
    if people_s:
        lines.append(('PEOPLE', people_s))
    if filer_s:
        lines.append(('FILER', filer_s))
    if oth:
        lines.append(('OTHERS', ' · '.join(oth)))
    lines.append(('CONTEXT', '; '.join(ctx) or 'none'))
    lines.append(('FLAGS', ' '.join(flags) or 'none'))
    return [f'{k:<11} {CTRL.sub(" ", v)}' for k, v in lines]


def main(argv):
    ap = argparse.ArgumentParser(prog='check.py')
    ap.add_argument('id')
    ap.add_argument('--refresh', action='store_true')
    ap.add_argument('--raw', metavar='FIELD')
    ns = ap.parse_args(argv)
    if not UUID.fullmatch(ns.id):
        print('usage: check.py <business_id uuid> [--refresh] [--raw <field.path>]')
        return 2
    try:
        p = fetch(ns.id.lower(), refresh=ns.refresh)
    except FetchError as e:
        print(e)
        return 1
    if p is None:
        return 0
    if ns.raw is not None:
        print(json.dumps(raw_slice(p, ns.raw), ensure_ascii=False))
    else:
        print('\n'.join(evaluate(p)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
