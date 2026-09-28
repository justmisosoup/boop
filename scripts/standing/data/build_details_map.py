"""Builds details_map.json (lookup + aliases) and review_needed.csv from the cleaned
status breakdown CSV and cleaning_changes.csv. Usage: python build_details_map.py <csv_dir>/"""
import pandas as pd, re, json, math
import sys
U=sys.argv[1] if len(sys.argv)>1 else './'  # folder with the two source CSVs
d=pd.read_csv(U+'per_jurisdiction_status_breakdown_clean.csv')
o=pd.read_csv(U+'per_jurisdiction_status_breakdown.csv')
for df in (d,o):
    p=df.label.str.split(' / ',n=2,expand=True); df['st'],df['sub'],df['det']=p[0],p[1],p[2]

ASSESS={'IN_GOOD_STANDING':'CLEAR','NOT_PUBLISHED':'NOTE','DELINQUENT':'REVIEW','AT_RISK':'REVIEW',
 'SUSPENDED':'CONCERN','SUCCEEDED':'REVIEW','TERMINATED_INVOLUNTARY':'CONCERN',
 'TERMINATED_VOLUNTARY':'CONCERN','TERMINATED_UNSPECIFIED':'CONCERN','NOT_FORMED':'CONCERN','UNRESOLVED':'REVIEW'}
TERM={'TERMINATED_INVOLUNTARY','TERMINATED_VOLUNTARY','TERMINATED_UNSPECIFIED'}

# ordered wording rules: first match wins
R=[('AMBIG', r'non-qualified|^(multiple|other|unknown|undefined|used|deleted|rescinded|transferred|active name|excused|redeemed)$|process of appeal'),
 ('NOT_FORMED', r'reserv|name registration|pending active|reject|pending filing|pending new|never activated|future effective|in ?process|^pending$|is pending|pending incorporation|pending domestication|incomplete|flawed|deficient|^filed$|^on file$|examination of|new application|^registered$|filing error'),
 ('AT_RISK', r'pending (admin|dissol|termin|inact|revoc|cancel|withdraw|forfeit|merger)|withdrawal pending|intent ?to|notice|ready for|initiated|future term|pendinact|pending inactive|pending termination|pending administrative'),
 ('SUCCEEDED', r'merg|convert|consolidat|domesticat|election to|conversion'),
 ('SUSPENDED', r'suspen|^default$'),
 ('TERMINATED_INVOLUNTARY', r'revok|revoc|forfeit|admin\w*\.? *(diss|withdr)|administratively (dissolved|withdrawn)|involuntar|judicial|void|ousted|failure to pay|abandon'),
 ('TERMINATED_VOLUNTARY', r'voluntar|withdra|surrender|renunciat|final report'),
 ('TERMINATED_UNSPECIFIED', r'dissol|terminat|inactive|expir|cancel|closed|dead|ceased|historical|not active|retired|deprecate'),
 ('DELINQUENT', r'delinq|past due|report due|non.?compl|noncompl|not current|no agent|agent vacated|agent resigned|not in good|^ngs$|unacceptable payment|^hold$|lapse|bad standing|not good'),
 ('REINSTATED', r'reinstat|revived|restored'),
 ('GOOD', r'good standing|^active|current|in existence|exist|compliant|in business|incorporated|organized|(?<!non-)qualified|^good|new corporation|ag-coop|special act|registered'),
]
def word(det):
    if det=='(none)': return None
    s=det.lower().strip()
    for k,rx in R:
        if re.search(rx,s): return k
    return 'UNMATCHED'

pub=d.assign(has=d['sub']!='(none)').groupby('state').apply(lambda g:(g.n*g.has).sum()/g.n.sum(),include_groups=False)
unpub=[s for s,g in d.groupby('state') if set(g.st)=={'UNKNOWN'}]

def classify(r):
    s,st,sub,det=r.state,r.st,r['sub'],r.det
    w=word(det); flags=[]; notes=[]; conf='rule'
    if s in unpub: return 'NOT_PUBLISHED',flags,['state does not publish status'],conf
    if det.lower().strip() in ('pending reinstatement','inactive-pending reinstatement'):
        return 'TERMINATED_INVOLUNTARY',flags,['reinstatement pending'],conf
    if isinstance(r.cleaning_action,str) and r.cleaning_action.startswith('AR legacy'):
        return 'TERMINATED_UNSPECIFIED',['STALE_RECORD'],['legacy row, not refreshed since Mar-2023'],'review'
    if re.search(r'(?<!past )report due',det.lower()) and st=='ACTIVE':
        return 'IN_GOOD_STANDING',flags,['report due but not yet past due'],'review'
    if w in ('AMBIG','UNMATCHED'):
        return 'UNRESOLVED',flags,[f'wording not classifiable: "{det}"'],'review'
    if st=='ACTIVE':
        if w in TERM or w=='SUCCEEDED':
            return 'AT_RISK',flags,['active but wording indicates termination/succession in progress'],conf
        if w=='NOT_FORMED': return 'NOT_FORMED',flags,['active status with pre-formation wording'],'review'
        if w in ('DELINQUENT','AT_RISK','SUSPENDED'): return w,flags,notes,conf
        # GOOD / REINSTATED / None → sub_status decides
        m={'GOOD_STANDING':'IN_GOOD_STANDING','NOT_GOOD_STANDING':'DELINQUENT','PENDING_INACTIVE':'AT_RISK',
           'DISSOLVED':'AT_RISK','PENDING_ACTIVE':'NOT_FORMED','(none)':'IN_GOOD_STANDING'}
        c=m[sub]
        if sub=='PENDING_ACTIVE':
            conf='review'
            if w=='REINSTATED': c='IN_GOOD_STANDING'; notes.append('recently reinstated')
            else: notes.append('active with pending-activation sub-status')
        if sub=='(none)' and pub[s]<0.10: notes.append('state rarely publishes sub-status')
        if w=='REINSTATED' and 'recently reinstated' not in notes: notes.append('reinstated')
        return c,flags,notes,conf
    if st=='INACTIVE':
        if w in TERM or w in ('SUCCEEDED','SUSPENDED','NOT_FORMED'): return w,flags,notes,conf
        if w=='DELINQUENT':
            return 'SUSPENDED',flags,['inactive with delinquency wording; likely lost powers, reinstatable'],'review'
        if w=='AT_RISK':
            return 'TERMINATED_UNSPECIFIED',flags,['inactive with pending-action wording'],'review'
        if w in ('GOOD','REINSTATED'): flags.append('STALE_WORDING'); notes.append('positive wording on inactive record is stale; enum used')
        m={'DISSOLVED':'TERMINATED_UNSPECIFIED','NOT_GOOD_STANDING':'TERMINATED_INVOLUNTARY',
           'PENDING_ACTIVE':'NOT_FORMED','PENDING_INACTIVE':'TERMINATED_UNSPECIFIED','GOOD_STANDING':'TERMINATED_UNSPECIFIED','(none)':'TERMINATED_UNSPECIFIED'}
        c=m[sub]
        if sub in ('NOT_GOOD_STANDING','PENDING_INACTIVE') and w is None: conf='review'
        if flags: conf='review'
        return c,flags,notes,conf
    # UNKNOWN outside unpublished states
    if w is None: return 'UNRESOLVED',flags,['status not provided'],conf
    c={'GOOD':'IN_GOOD_STANDING','REINSTATED':'IN_GOOD_STANDING'}.get(w,w)
    return c,flags,['status UNKNOWN; category from wording only'],'review'

E={}; rows=[]
for _,r in d.iterrows():
    c,f,nt,conf=classify(r)
    of=r.outlier_flags if isinstance(r.outlier_flags,str) else ''
    f=f+[x.split(':')[0].strip() for x in of.split(';') if x.strip()]
    yr=[None if math.isnan(r.p05) else int(r.p05), None if math.isnan(r.p95) else int(r.p95)]
    normal= c=='NOT_PUBLISHED' or r.pct>=1.0
    e={'c':c,'a':ASSESS[c],'normal':normal,'pct':round(float(r.pct),3),'n':int(r.n),'yr':yr}
    if f: e['flags']=f
    if nt: e['note']='; '.join(nt)
    if conf=='review': e['review']=True
    E[f'{r.state}|{r.label.replace(" / ","|")}']=e
    rows.append(dict(state=r.state,label=r.label,n=int(r.n),pct=round(float(r.pct),3),suggested_category=c,
        assessment=ASSESS[c],reason='; '.join(nt),flags=','.join(f),review=conf=='review'))

# aliases: raw labels from original CSV that no longer exist in the clean file
clean=set(zip(d.state,d.label)); A={}
for _,r in o.iterrows():
    if (r.state,r.label) in clean: continue
    tgt=None; fl=[]; note=None
    if r.state=='WY' and r.det=='ACTIVE' and r.st=='INACTIVE':
        tgt='INACTIVE / (none) / INACTIVE'; fl=['ASSUMED_INACTIVE']
        note='dropped from WY bulk feed >30 days; confirm via certificate if material'
    elif r.state=='AR' and r.label=='INACTIVE / GOOD_STANDING / Good Standing':
        tgt='INACTIVE / (none) / (none)'; fl=['STALE_RECORD']
    else:
        cand=d[(d.state==r.state)&(d.det==r.det)]
        if len(cand)==0: cand=d[(d.state==r.state)&(d.det.str.lower()==r.det.lower())]
        if len(cand)>1: cand=cand[cand['sub']==r['sub']] if (cand['sub']==r['sub']).any() else cand
        if len(cand)>1: cand=cand[cand.st!='UNKNOWN']
        if len(cand)>1 and r.st!='UNKNOWN': cand=cand[cand.st==r.st] if (cand.st==r.st).any() else cand
        if len(cand)>=1: tgt=cand.sort_values('n',ascending=False).label.iloc[0]
    assert tgt is not None and (r.state,tgt) in clean, (r.state,r.label)
    a={'to':f'{r.state}|{tgt.replace(" / ","|")}'}
    if fl: a['flags']=fl
    if note: a['note']=note
    A[f'{r.state}|{r.label.replace(" / ","|")}']=a

meta={'version':'0.1-draft','source':'per_jurisdiction_status_breakdown_clean.csv + cleaning_changes.csv',
 'key':'STATE|STATUS|SUB_STATUS|status_details; null fields = "(none)"; status_details exact-case',
 'lookup':'check aliases first (raw API label), then entries; alias flags add to entry flags',
 'miss':'no key → category UNRESOLVED, flag UNSEEN_STATUS',
 'assessment':ASSESS,'normal':'pct >= 1.0 of state records, or state does not publish',
 'review':'entry needs human confirmation (see review_needed.csv)'}
json.dump({'_meta':meta,'aliases':A,'entries':E},open('details_map.json','w'),separators=(',',':'))
R_=pd.DataFrame(rows)
rv=R_[R_.review].sort_values('n',ascending=False).copy(); rv['your_category']=''; rv['your_note']=''
rv.drop(columns='review').to_csv('review_needed.csv',index=False)

print('entries',len(E),'aliases',len(A),'review rows',len(rv),'review records',rv.n.sum())
print(R_.groupby('suggested_category').agg(rows=('n','size'),records=('n','sum')).sort_values('records',ascending=False))
