import pathlib, json, hashlib, re
root=pathlib.Path('/Users/dylanxu/coding_tree')
ev=root/'docs/validation/m9-02/implementation-2026-10-10'
sha=lambda data:hashlib.sha256(data).hexdigest()
source=json.loads((ev/'source-audit-resume-v2.json').read_text())['four_source_sha256']
assert all(sha((root/p).read_bytes())==h for p,h in source.items())
final=['focused-resume-v2','combined-resume-v2','core-types-resume-v2','schema-types-resume-v2','lint-resume-v2','format-resume-v2','source-audit-command-resume-v2']
records={}
for p in sorted(ev.glob('*.json')):
 meta=json.loads(p.read_text())
 if 'argv' not in meta: continue
 name=p.stem
 raw=(ev/(name+'.log')).read_bytes()
 assert len(raw)<2_000_000
 assert sha(raw)==meta['log_sha256'], name+' changed log'
 records[name]={'exit':meta['exit'],'metadata_sha256':sha(p.read_bytes()),'log_sha256':sha(raw),'log_bytes':len(raw),'command_sha256':sha(json.dumps({'argv':meta['argv'],'cwd':meta['cwd']},sort_keys=True,separators=(',',':')).encode()),'source_matches_candidate':meta['source_sha256']==source}
for name in final:
 assert records[name]['exit']==0 and records[name]['source_matches_candidate'], name+' final mismatch'
assert re.search(r'79 pass\s+0 fail\s+456 expect', (ev/'focused-resume-v2.log').read_text())
assert re.search(r'145 pass\s+0 fail\s+650 expect', (ev/'combined-resume-v2.log').read_text())
archived=json.loads((root/'docs/validation/m9-02/continuation-root-2026-10-10/interrupted-audit.json').read_text())['completed_check_records']
assert all(records[name]['metadata_sha256']==old['metadata_sha256'] and records[name]['log_sha256']==old['log_sha256'] for name,old in archived.items())
report=root/'docs/validation/M9-02-implementation-2026-10-10.md'
assert report.read_bytes().endswith(b'\n')
assert all(line.rstrip()==line for line in report.read_text().splitlines())
assert 'No task credit is claimed' in report.read_text()
excluded={'candidate-freeze-resume-v2.json','evidence-sha256-resume-v2.txt','freeze-command-resume-v2.log','freeze-command-resume-v2.json'}
files={str(p.relative_to(root)):sha(p.read_bytes()) for p in sorted(ev.iterdir()) if p.is_file() and p.name not in excluded}
files[str(report.relative_to(root))]=sha(report.read_bytes())
freeze={'status':'DONE_WITH_CONCERNS; candidate only; independent review pending','task':'M9-02','date':'2026-10-10','source_sha256':source,'report_sha256':sha(report.read_bytes()),'final_checks':final,'completed_command_records':records,'archived_interrupted_hashes_unchanged':True,'evidence_files_sha256':files,'uncompleted_exploratory_attempt':{'name':'contract-red','status':'manual interruption with initially buffered stdout; no completed raw test log/exit/source freeze; no acceptance credit','observed_wrapper_interruption_exit':130},'verified_task_credit':'unchanged; root owns review, Git and ledger'}
(ev/'candidate-freeze-resume-v2.json').write_text(json.dumps(freeze,indent=2)+'\n')
(ev/'evidence-sha256-resume-v2.txt').write_text(''.join(h+'  '+p+'\n' for p,h in files.items()))
print('PASS: 4-source candidate; 7 final checks; 79/456 focused; 145/650 combined; all completed log hashes verified; archived checkpoint evidence unchanged.')
