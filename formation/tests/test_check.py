"""python3 -m unittest discover -s formation/tests"""
import copy, io, json, os, sys, unittest
from contextlib import redirect_stdout
from datetime import date
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import build, check  # noqa: E402

TODAY = date(2026, 9, 25)


def fx(name):
    with open(os.path.join(HERE, 'fixtures', f'{name}.json')) as f:
        return json.load(f)


def run(p, today=TODAY):
    lines = check.evaluate(p, today)
    return {l[:11].strip(): l[12:] for l in lines}, lines


class Fixtures(unittest.TestCase):
    def test_kairos(self):
        v, lines = run(fx('kairos'))
        self.assertEqual(v['ASSESSMENT'], 'CLEAR · IN_GOOD_STANDING')
        self.assertEqual(v['FORMATION'], 'NY DOMESTIC #6552607  2022-08-01  LLC  ACTIVE / (none) / "Active"')
        self.assertIn('LEGALZOOM USCA, INC. (Service of Process)', v['FILER'])
        self.assertEqual(v['PEOPLE'], 'none on filing')
        self.assertTrue(v['MATCH'].startswith('name ✓'))
        self.assertIn('type – (not submitted)', v['MATCH'])
        self.assertEqual(v['FLAGS'], 'none')
        self.assertNotIn('TASK_DISAGREES', v['TASKS'])
        self.assertLessEqual(len(lines), 15)

    def test_wy_assumed_inactive_alias(self):
        v, _ = run(fx('wy_alias'))
        self.assertEqual(v['ASSESSMENT'], 'CONCERN · TERMINATED_UNSPECIFIED')
        self.assertIn('INACTIVE / GOOD_STANDING / "ACTIVE"', v['FORMATION'])
        self.assertIn('read as INACTIVE / (none) / INACTIVE', v['FORMATION'])
        self.assertIn('ASSUMED_INACTIVE', v['FLAGS'])
        self.assertIn('dropped from WY bulk feed', v['CONTEXT'])
        self.assertIn('REGISTERED AGENTS INC', v['FILER'])
        # task says success on an ACTIVE-looking raw label; we say CONCERN
        self.assertIn('TASK_DISAGREES', v['FLAGS'])

    def test_tn_active_dissolved_merged_finding(self):
        v, _ = run(fx('tn_active_dissolved'))
        self.assertEqual(v['ASSESSMENT'], 'REVIEW · AT_RISK')
        self.assertTrue(v['CONTEXT'].startswith('active but at risk: Active - Dissolved'))
        self.assertNotIn('wording indicates termination', v['CONTEXT'])  # merged, not repeated
        self.assertIn('uncommon: 4.0K TN filings', v['CONTEXT'])

    def test_de_not_published_is_normal(self):
        v, _ = run(fx('de'))
        self.assertEqual(v['ASSESSMENT'], 'NOTE · NOT_PUBLISHED')
        self.assertIn('UNKNOWN / (none) / "(none)"', v['FORMATION'])
        self.assertEqual(v['FLAGS'], 'none')
        self.assertEqual(v['CERT'], 'DE in-state, 8d old, standing not stated → no upgrade')

    def test_missing_domestic(self):
        v, _ = run(fx('missing_domestic'))
        self.assertEqual(v['ASSESSMENT'], 'REVIEW · UNRESOLVED')
        self.assertEqual(v['FORMATION'], 'none in DE')
        self.assertEqual(v['FLAGS'], 'NO_DOMESTIC_FILING')
        self.assertIn('entity_type suppressed', v['TASKS'])
        self.assertNotIn('ENTITY_TYPE', v['FLAGS'])


class Rules(unittest.TestCase):
    def test_unseen_status(self):
        p = fx('kairos')
        p['registrations'][0]['status_details'] = 'Something New'
        v, _ = run(p)
        self.assertEqual(v['ASSESSMENT'], 'REVIEW · UNRESOLVED')
        self.assertIn('UNSEEN_STATUS', v['FLAGS'])

    def test_task_disagrees_failure_vs_clear(self):
        p = fx('kairos')
        p['review']['tasks'][1]['status'] = 'failure'  # sos_domestic
        v, _ = run(p)
        self.assertIn('TASK_DISAGREES (sos_domestic)', v['TASKS'])
        self.assertEqual(v['ASSESSMENT'], 'CLEAR · IN_GOOD_STANDING')  # tasks never change the verdict

    def test_provisional(self):
        p = fx('kairos')
        e = next(k for k, e in check.dmap()['entries'].items() if e.get('review') and k.startswith('NY|'))
        st, s, sub, det = e.split('|')
        p['registrations'][0].update(status=s.lower(), sub_status=None if sub == '(none)' else sub,
                                     status_details=None if det == '(none)' else det)
        v, _ = run(p)
        self.assertTrue(v['ASSESSMENT'].endswith('PROVISIONAL'))

    def cert(self, standing, filed='2026-09-17T00:00:00.000Z', state='DE'):
        p = fx('de')
        for d in p['documents']:
            if 'good standing' in d['document_type'].lower():
                d['filing_date'] = filed
                d['source']['metadata']['state'] = state
                if standing:
                    d['standing_status'] = standing
        return run(p)[0]

    def test_cert_upgrade(self):
        v = self.cert('Good Standing')
        self.assertEqual(v['ASSESSMENT'], 'CLEAR · IN_GOOD_STANDING')
        self.assertIn('CERT_UPGRADE', v['FLAGS'])
        self.assertIn('8d old', v['CERT'])

    def test_cert_stale_no_upgrade(self):
        v = self.cert('Good Standing', filed='2026-05-01T00:00:00.000Z')
        self.assertEqual(v['ASSESSMENT'], 'NOTE · NOT_PUBLISHED')

    def test_cert_not_good(self):
        v = self.cert('Void')
        self.assertIn('CERT_NOT_GOOD', v['FLAGS'])
        self.assertEqual(v['ASSESSMENT'], 'NOTE · NOT_PUBLISHED')

    def test_cert_foreign(self):
        v = self.cert('Good Standing', state='CA')
        self.assertIn('foreign qualification', v['CERT'])
        self.assertNotIn('CERT_UPGRADE', v['FLAGS'])

    def test_low_confidence(self):
        v = self.cert(None)
        p = fx('de')
        for d in p['documents']:
            d['metadata'] = {'confidence': 0.5}
        v, _ = run(p)
        self.assertIn('LOW_CONFIDENCE', v['FLAGS'])

    def test_entity_type(self):
        p = fx('kairos')
        p['submitted']['entity_type'] = 'llc'
        self.assertIn('type ✓', run(p)[0]['MATCH'])
        p['submitted']['entity_type'] = 'LP'
        v, _ = run(p)
        self.assertIn('type ✗ (PARTNERSHIP vs LLC)', v['MATCH'])
        self.assertIn('ENTITY_TYPE_MISMATCH', v['FLAGS'])
        p['submitted']['entity_type'] = 'banana'
        self.assertIn('UNMAPPED_ENTITY_TYPE', run(p)[0]['FLAGS'])
        self.assertEqual(check.norm_type('S-Corp'), 'CORPORATION')
        self.assertEqual(check.norm_type('LLP'), 'PARTNERSHIP')

    def test_names(self):
        n = check.norm_name
        self.assertEqual(n('Kairos 801, L.L.C.'), n('KAIROS 801 LLC'))
        self.assertEqual(n('Acme Inc.'), n('ACME INCORPORATED'))
        self.assertEqual(n('WOO YOUNG LEE DDS INC'), n('WOO YOUNG LEE, D.D.S., INC.'))
        self.assertNotEqual(n('Acme LLC'), n('Acme Inc'))

    def test_filing_date_mismatch(self):
        p = fx('de')
        reg = next(r for r in p['registrations'] if r['jurisdiction'] == 'DOMESTIC')
        p['documents'].append({'document_type': 'Initial_filing', 'filing_date': '2019-01-01T00:00:00.000Z',
                               'source': {'type': 'registration', 'id': reg['id'], 'metadata': {'state': 'DE'}}, 'metadata': {}})
        v, _ = run(p)
        self.assertIn('date ✗ (articles 2019-01-01)', v['MATCH'])

    def test_date_anomaly(self):
        E = check.dmap()['entries']
        k = next(k for k, e in E.items() if 'RETIRED' in e.get('flags', []) and None not in e['yr'] and not e.get('review'))
        st, s, sub, det = k.split('|')
        p = fx('kairos')
        p['formation']['formation_state'] = st
        p['registrations'][0].update(state=st, status=s.lower(), sub_status=None if sub == '(none)' else sub,
                                     status_details=None if det == '(none)' else det,
                                     registration_date=f'{E[k]["yr"][1] + 1}-01-01')
        v, _ = run(p)
        self.assertIn('DATE_ANOMALY', v['FLAGS'])

    def test_multiple_domestic_active_formation_wins(self):
        # Alliance Transfer shape: an active NY filing wins over NEWER inactive ones
        p = fx('kairos')
        newer = copy.deepcopy(p['registrations'][0])
        newer.update(id='x', file_number='1', status='inactive', status_details='Inactive', registration_date='2024-01-01')
        p['registrations'].append(newer)
        v, _ = run(p)
        self.assertEqual(v['ASSESSMENT'], 'CLEAR · IN_GOOD_STANDING')
        self.assertIn('#6552607', v['FORMATION'])
        self.assertIn('MULTIPLE_DOMESTIC', v['FLAGS'])
        self.assertIn('NY DOMESTIC #1 TERMINATED_UNSPECIFIED', v['OTHERS'])
        self.assertIn('2 domestic filings; using #6552607 (active in the formation state)', v['CONTEXT'])

    def test_multiple_domestic_by_date_when_formation_not_active(self):
        # Andytown shape: CA converted out, newer DE domestic carries on
        p = fx('kairos')
        r = p['registrations'][0]
        r.update(status='inactive', status_details='Inactive')
        de = copy.deepcopy(r)
        de.update(id='de', state='DE', file_number='999', status='unknown', status_details=None, registration_date='2024-01-01')
        p['registrations'].append(de)
        r['status_details'] = 'Converted Out'
        v, _ = run(p)
        self.assertEqual(v['ASSESSMENT'], 'NOTE · NOT_PUBLISHED')  # assessed on the current filing
        self.assertTrue(v['FORMATION'].startswith('NY DOMESTIC #6552607'))  # the original formation is kept
        self.assertTrue(v['NOW'].startswith('DE DOMESTIC #999'))
        self.assertIn('formed in NY; its domestic filing is now in DE (the NY filing converted out)', v['CONTEXT'])
        self.assertEqual(v['FLAGS'], 'FORMATION_MOVED')

    def test_related_corporation_does_not_compete(self):
        # Alliance shape: the active filing is under another name, so the same-name ones decide
        p = fx('kairos')
        r = p['registrations'][0]
        other = copy.deepcopy(r)
        other.update(id='o', name='KAIROS ENTERPRISES IV, INC.', file_number='777', registration_date='2024-01-01')
        r.update(status='inactive', status_details='Inactive')
        p['registrations'].append(other)
        v, _ = run(p)
        self.assertEqual(v['ASSESSMENT'], 'CONCERN · TERMINATED_UNSPECIFIED')
        self.assertIn('NY DOMESTIC #777 (related, different name: KAIROS ENTERPRISES IV, INC.)', v['OTHERS'])
        self.assertNotIn('MULTIPLE_DOMESTIC', v['FLAGS'])

    def test_task_reading_other_domestic(self):
        # Checkr shape: DE formation UNKNOWN, a stray UT "DOMESTIC" that is inactive, task says Domestic Inactive
        p = fx('de')
        p['registrations'].append({'id': 'ut', 'state': 'UT', 'jurisdiction': 'DOMESTIC', 'status': 'inactive',
                                   'sub_status': None, 'status_details': 'Expired', 'file_number': '123-0142',
                                   'registration_date': '2021-05-28'})
        p['registrations'].append({'id': 'utf', 'state': 'UT', 'jurisdiction': 'FOREIGN', 'status': 'active',
                                   'sub_status': None, 'status_details': 'Active', 'file_number': '123-0143',
                                   'registration_date': '2021-05-28'})
        t = next(t for t in p['review']['tasks'] if t['key'] == 'sos_domestic')
        t.update(status='failure', sub_label='Domestic Inactive')
        v, _ = run(p)
        self.assertEqual(v['ASSESSMENT'], 'NOTE · NOT_PUBLISHED')
        self.assertIn('matches UT DOMESTIC #123-0142 (inactive, Expired), not the DE filing used', v['CONTEXT'])
        self.assertIn('UT DOMESTIC #123-0142 (twin of FOREIGN #123-0143, active; not a formation)', v['OTHERS'])
        self.assertTrue(v['FORMATION'].startswith('DE DOMESTIC'))  # newer, but a twin: never the formation
        self.assertEqual(v['FLAGS'], 'none')

    def test_filer_split(self):
        p = fx('kairos')
        p['registrations'][0]['officers'].append({'name': 'JANE DOE', 'roles': ['Member']})
        p['registrations'][0]['officers'].append({'name': 'JANE DOE', 'roles': ['Manager']})
        v, _ = run(p)
        self.assertEqual(v['PEOPLE'], 'JANE DOE (Member, Manager)')
        self.assertNotIn('LEGALZOOM', v['PEOPLE'])

    def test_raw_slice(self):
        p = fx('kairos')
        self.assertEqual(check.raw_slice(p, 'registrations.officers')[0][0]['name'], 'LEGALZOOM USCA, INC.')


class ReviewRegressions(unittest.TestCase):
    """One test per confirmed finding from the adversarial review."""

    def test_filer_needs_word_boundary(self):
        p = fx('kairos')
        p['registrations'][0]['officers'] = [{'name': n, 'roles': ['Member']} for n in
                                             ('PATRICK DOOLAN', 'SELECT CORPORATION', 'MARY CLERKYN', 'LEGALZOOM USCA, INC.')]
        v, _ = run(p)
        self.assertIn('PATRICK DOOLAN', v['PEOPLE'])
        self.assertIn('SELECT CORPORATION', v['PEOPLE'])
        self.assertIn('MARY CLERKYN', v['PEOPLE'])
        self.assertIn('LEGALZOOM', v['FILER'])

    def test_unclear_types_are_not_mismatches(self):
        p = fx('kairos')
        p['submitted']['entity_type'] = 'LLC'
        p['registrations'][0]['entity_type'] = 'PROFESSIONAL ASSOCIATION'
        v, _ = run(p)
        self.assertIn('type ? (unmapped registry', v['MATCH'])
        self.assertNotIn('ENTITY_TYPE_MISMATCH', v['FLAGS'])
        self.assertNotIn('TASK_DISAGREES', v['FLAGS'])
        p['submitted']['entity_type'] = 'UNKNOWN'
        p['registrations'][0]['entity_type'] = 'LLC'
        self.assertIn('type – (submitted UNKNOWN)', run(p)[0]['MATCH'])

    def test_future_cert_does_not_upgrade(self):
        v = Rules.cert(self, 'Good Standing', filed='2026-10-01T00:00:00.000Z')
        self.assertEqual(v['ASSESSMENT'], 'NOTE · NOT_PUBLISHED')
        self.assertIn('CERT_DATE_ANOMALY', v['FLAGS'])
        self.assertIn('(future)', v['CERT'])

    def test_older_stated_cert_used_and_foreign_noted(self):
        p = fx('de')
        cert = next(d for d in p['documents'] if 'good standing' in d['document_type'].lower())
        older = copy.deepcopy(cert)
        older.update(filing_date='2026-09-01T00:00:00.000Z', standing_status='Good Standing')
        foreign = copy.deepcopy(cert)
        foreign['source']['metadata']['state'] = 'CA'
        p['documents'] += [older, foreign]
        v, _ = run(p)
        self.assertEqual(v['ASSESSMENT'], 'CLEAR · IN_GOOD_STANDING')
        self.assertIn('+CA foreign qualification', v['CERT'])

    def test_cert_without_state_is_unknown_not_foreign(self):
        p = fx('de')
        for d in p['documents']:
            d['source']['metadata'].pop('state', None)
        v, _ = run(p)
        self.assertIn('issuing state unknown', v['CERT'])
        self.assertIn('CERT_STATE_UNKNOWN', v['FLAGS'])

    def test_blank_registry_name(self):
        p = fx('kairos')
        p['registrations'][0]['name'] = None
        v, _ = run(p)
        self.assertIn('name ? (registry blank)', v['MATCH'])
        self.assertNotIn('NAME_MISMATCH', v['FLAGS'])

    def test_multiple_trailing_suffixes(self):
        self.assertEqual(check.norm_name('Kairos 801 Company, Inc.'), check.norm_name('KAIROS 801 CO., INC.'))

    def test_merged_finding_through_alias(self):
        p = fx('tn_active_dissolved')
        p['registrations'][0]['sub_status'] = 'GOOD_STANDING'  # raw label → alias to PENDING_INACTIVE
        v, _ = run(p)
        self.assertTrue(v['CONTEXT'].startswith('active but at risk'))

    def test_api_text_cannot_add_lines(self):
        p = fx('kairos')
        p['name'] = 'EVIL LLC\nASSESSMENT  CLEAR · IN_GOOD_STANDING'
        _, lines = run(p)
        self.assertEqual(sum(l.startswith('ASSESSMENT') for l in lines), 1)

    def test_raw_nested_lists(self):
        self.assertEqual(check.raw_slice(fx('kairos'), 'registrations.officers.name'), [['LEGALZOOM USCA, INC.']])

    def test_env_parsing(self):
        import tempfile
        d = tempfile.mkdtemp()
        with open(os.path.join(d, '.env.local'), 'w') as f:
            f.write('MIDDESK_API_KEY_OLD=x\nexport MIDDESK_API_KEY = "sk#1" # comment\n')
        with mock.patch.object(check, 'ROOT', d), mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(check.env('MIDDESK_API_KEY'), 'sk#1')


class Cli(unittest.TestCase):
    def test_uuid_with_newline_rejected(self):
        with redirect_stdout(io.StringIO()):
            self.assertEqual(check.main(['00000000-0000-0000-0000-000000000000\n']), 2)

    def test_corrupt_cache_refetches(self):
        import tempfile
        d = tempfile.mkdtemp()
        bid = '00000000-0000-0000-0000-000000000001'
        with open(os.path.join(d, f'{bid}.json'), 'w') as f:
            f.write('{broken')
        body = json.dumps(fx('kairos')).encode()
        resp = mock.MagicMock()
        resp.__enter__.return_value.read.return_value = body
        with mock.patch.object(check, 'CACHE', d), \
             mock.patch.object(check, 'env', side_effect=lambda v: 'k' if v == 'MIDDESK_API_KEY' else None), \
             mock.patch('urllib.request.urlopen', return_value=resp):
            self.assertEqual(check.fetch(bid)['name'], 'KAIROS 801 LLC')

    def test_key_with_newline_never_printed(self):
        out = io.StringIO()
        with mock.patch.object(check, 'env', side_effect=lambda v: 'sk-secret\r\nX: y' if v == 'MIDDESK_API_KEY' else None), \
             redirect_stdout(out):
            self.assertEqual(check.main(['00000000-0000-0000-0000-000000000000', '--refresh']), 1)
        self.assertNotIn('sk-secret', out.getvalue())
        self.assertEqual(len(out.getvalue().splitlines()), 1)

    def test_network_oserror_one_line(self):
        out = io.StringIO()
        with mock.patch.object(check, 'env', side_effect=lambda v: 'k' if v == 'MIDDESK_API_KEY' else None), \
             mock.patch('urllib.request.urlopen', side_effect=ConnectionResetError()), redirect_stdout(out):
            self.assertEqual(check.main(['00000000-0000-0000-0000-000000000000', '--refresh']), 1)
        self.assertEqual(out.getvalue(), 'ERROR network ConnectionResetError\n')

    def test_bad_id(self):
        with redirect_stdout(io.StringIO()):
            self.assertEqual(check.main(['nope']), 2)

    def test_404_silent(self):
        import urllib.error
        err = urllib.error.HTTPError('u', 404, 'Not Found', {}, None)
        out = io.StringIO()
        with mock.patch.object(check, 'env', side_effect=lambda v: 'k' if v == 'MIDDESK_API_KEY' else None), \
             mock.patch('urllib.request.urlopen', side_effect=err), redirect_stdout(out):
            self.assertEqual(check.main(['00000000-0000-0000-0000-000000000000', '--refresh']), 0)
        self.assertEqual(out.getvalue(), '')

    def test_other_error_one_line(self):
        import urllib.error
        err = urllib.error.HTTPError('u', 403, 'Forbidden', {}, None)
        out = io.StringIO()
        with mock.patch.object(check, 'env', side_effect=lambda v: 'secret-key' if v == 'MIDDESK_API_KEY' else None), \
             mock.patch('urllib.request.urlopen', side_effect=err), redirect_stdout(out):
            self.assertEqual(check.main(['00000000-0000-0000-0000-000000000000', '--refresh']), 1)
        self.assertEqual(out.getvalue(), 'ERROR 403 Forbidden\n')
        self.assertNotIn('secret-key', out.getvalue())


class Build(unittest.TestCase):
    def test_override_apply_and_revert(self):
        m = copy.deepcopy(check.dmap())
        row = next(k for k, e in m['entries'].items() if e.get('review'))
        st, rest = row.split('|', 1)
        lbl = rest.replace('|', ' / ')
        self.assertEqual(build.apply_overrides(m, {(st, lbl): ('SUSPENDED', 'checked by hand')}), [])
        e = m['entries'][row]
        self.assertEqual((e['c'], e['a'], e['your_note']), ('SUSPENDED', 'CONCERN', 'checked by hand'))
        self.assertNotIn('review', e)
        self.assertEqual(build.validate(m), [])
        build.apply_overrides(m, {})
        self.assertTrue(m['entries'][row].get('review'))
        self.assertNotIn('ovr', m['entries'][row])

    def test_override_bad_category(self):
        m = copy.deepcopy(check.dmap())
        row = next(k for k, e in m['entries'].items() if e.get('review'))
        st, rest = row.split('|', 1)
        errs = build.apply_overrides(m, {(st, rest.replace('|', ' / ')): ('NOPE', '')})
        self.assertTrue(errs and 'not in _meta.assessment' in errs[0])

    def test_validate_catches_bad_alias(self):
        m = copy.deepcopy(check.dmap())
        m['aliases']['XX|A|B|C'] = {'to': 'XX|missing'}
        self.assertTrue(any('XX|missing' in e for e in build.validate(m)))


if __name__ == '__main__':
    unittest.main()
