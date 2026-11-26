#!/usr/bin/env python3
"""Print a reviewed project-specific migration plan; never connects to or changes a database."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'supabase/project-manifest.json'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', choices=['main', 'teacher-community'])
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    projects = json.loads(MANIFEST.read_text())['projects']
    assigned = [name for project in projects.values() for name in project['migrations']]
    actual = {path.name for path in (ROOT / 'supabase/migrations').glob('*.sql')}
    if len(assigned) != len(set(assigned)) or set(assigned) != actual:
        raise SystemExit('Migration assignments are incomplete/duplicated. Missing: ' + str(sorted(actual-set(assigned))) + '; unknown: ' + str(sorted(set(assigned)-actual)))
    for name, project in projects.items():
        if project['migrations'] != sorted(project['migrations']):
            raise SystemExit('Migration order is not chronological: ' + name)
    if args.check:
        print(f'Each of {len(actual)} migrations is assigned to exactly one project. This does not validate the missing production baseline.')
    if args.project:
        project = projects[args.project]
        if project['requires_existing_baseline']:
            print('# STOP on a new empty project: obtain and review the existing baseline first.')
        print('# Target project: ' + args.project + ' — review project identity and take a backup before applying anything.')
        for name in project['migrations']:
            print('supabase/migrations/' + name)
    if not args.project and not args.check:
        parser.error('choose --check or --project; this command is read-only')

if __name__ == '__main__':
    main()
