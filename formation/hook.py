"""UserPromptSubmit hook: run check.py for business UUIDs in the prompt, inject verdicts.

Reads the hook JSON on stdin. Silent when no UUID matches or every id is a 404.
Never blocks the prompt: always exits 0; a timeout (>10s) or error becomes one line.
"""
import json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
UUID = re.compile(r'\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b')
BUDGET_S, MAX_IDS = 10.0, 5


def ids_in(prompt):
    seen = []
    for m in UUID.findall(prompt or ''):
        if m.lower() not in seen:
            seen.append(m.lower())
    return seen[:MAX_IDS]


def run_one(bid, deadline):
    left = deadline - time.monotonic()
    if left <= 0:
        return bid, None, 'timeout'
    try:
        p = subprocess.run([sys.executable, os.path.join(HERE, 'check.py'), bid],
                           capture_output=True, text=True, timeout=left)
    except subprocess.TimeoutExpired:
        return bid, None, 'timeout'
    out = p.stdout.strip()
    if p.returncode != 0:
        why = (out or p.stderr.strip() or f'exit {p.returncode}').splitlines()[-1]
        return bid, None, why
    return bid, out, None


def build(prompt):
    ids = ids_in(prompt)
    if not ids:
        return ''
    deadline = time.monotonic() + BUDGET_S
    with ThreadPoolExecutor(max_workers=len(ids)) as ex:
        results = list(ex.map(lambda b: run_one(b, deadline), ids))
    blocks, problems = [], []
    for bid, out, err in results:
        if err == 'timeout':
            problems.append(f'{bid}: timed out after {BUDGET_S:.0f}s')
        elif err:
            problems.append(f'{bid}: {err}')
        elif out:
            blocks.append(f'FORMATION CHECK: {bid}\n{out}')
    if problems:
        blocks.append('FORMATION CHECK: not run for ' + '; '.join(problems))
    return '\n\n'.join(blocks)


def main():
    try:
        prompt = json.load(sys.stdin).get('prompt', '')
        ctx = build(prompt)
    except Exception as e:  # never block the prompt
        ctx = f'FORMATION CHECK: hook error: {type(e).__name__}: {e}'.splitlines()[0]
    if ctx:
        print(json.dumps({'hookSpecificOutput': {'hookEventName': 'UserPromptSubmit', 'additionalContext': ctx}}))
    return 0


if __name__ == '__main__':
    sys.exit(main())
