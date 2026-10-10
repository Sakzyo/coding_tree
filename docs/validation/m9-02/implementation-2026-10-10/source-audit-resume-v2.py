import pathlib, hashlib, json, re
root=pathlib.Path('/Users/dylanxu/coding_tree')
evidence=root/'docs/validation/m9-02/implementation-2026-10-10'
paths=['packages/core/src/ftc/operations.ts','packages/schema/src/ftc-operation.ts','packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts','packages/core/test/ftc/robot-approvals-and-operations/m9-02.test.ts']
sha=lambda data:hashlib.sha256(data).hexdigest()
manifest={p:sha((root/p).read_bytes()) for p in paths}
interrupted=json.loads((root/'docs/validation/m9-02/continuation-root-2026-10-10/interrupted-audit.json').read_text())['source_sha256']
protected=[]
for line in (root/'docs/validation/m9-02/preparation/source-sha256.txt').read_text().splitlines():
 expected,p=line.split('  ',1)
 if p in paths: continue
 actual=sha((root/p).read_bytes())
 protected.append({'path':p,'expected':expected,'actual':actual,'matches':actual==expected})
old_test=(root/paths[2]).read_text().replace('Object.keys(operations)).toEqual(["prepareOperation", "approveOperation"])','Object.keys(operations)).toEqual(["prepareOperation"])')
old_schema=(root/paths[1]).read_text()
old_schema=old_schema[:old_schema.index('export interface ApprovalRequest')]+old_schema[old_schema.index('export interface OperationError'):]
for code in ['approval_consumed','untrusted_approval','approval_unavailable','operation_unknown','approval_rejected','approval_expired','approval_cancelled']:
 old_schema=old_schema.replace('    "'+code+'",\n','')
old_operations=(root/paths[0]).read_text().replace('Cause, Context','Context').replace('  ApprovalRequest,\n','')
start=old_operations.index('// Trusted local adapter records')
old_operations=old_operations[:start]+old_operations[old_operations.index('export interface Ports {',start):]
start=old_operations.index('  readonly approval?: {')
old_operations=old_operations[:start]+old_operations[old_operations.index('\n}\n\nexport interface Interface',start)+1:]
start=old_operations.index('  readonly approveOperation: (')
old_operations=old_operations[:start]+old_operations[old_operations.index('\n}\n\nexport class Service',start)+1:]
start=old_operations.index('    const claimed = new Set')
old_operations=old_operations[:start]+'    let closed = false\n'+old_operations[old_operations.index('    yield* Effect.addFinalizer',start):]
for line in ['        ready = false\n','        claimed.clear()\n','        consent.clear()\n','        retired.clear()\n']:
 old_operations=old_operations.replace(line,'')
start=old_operations.index('    const observer = ports.approval?.observe')
old_operations=old_operations[:start]+old_operations[old_operations.index('    return {\n      prepareOperation:',start):]
start=old_operations.index('      approveOperation: Effect.fn')
old_operations=old_operations[:start]+old_operations[old_operations.index('\n    }\n  })',start)+1:]
inverse={paths[0]:{'sha256':sha(old_operations.encode()),'expected':'090da2676b7ba2298867467004e3cb8a0debf7046b35ec23661a4a6590441bb7'},paths[1]:{'sha256':sha(old_schema.encode()),'expected':'1c2e66f286fced3c1ed251c2f326b96c5fe07af78a990b6168b41a8f18eb4ae5'},paths[2]:{'sha256':sha(old_test.encode()),'expected':'ae346562f8068fbf3be72c074e00290bdd8f8ac9bfb3d2615d347f4a67108a41'}}
for item in inverse.values(): item['matches']=item['sha256']==item['expected']
imports={p:re.findall(r'^import.* from "([^"]+)"', (root/p).read_text(), re.M) for p in paths[:2]}
whitespace={p:{'trailing_lines':[i+1 for i,line in enumerate((root/p).read_text().splitlines()) if line.rstrip()!=line],'final_newline':(root/p).read_bytes().endswith(b'\n')} for p in paths}
result={'four_source_sha256':manifest,'matches_interrupted_snapshot':{p:manifest[p]==interrupted[p] for p in paths},'protected_source_checks':protected,'inverse_assigned_edits_restore_reviewed_prerequisite':inverse,'product_imports':imports,'whitespace':whitespace}
(evidence/'source-audit-resume-v2.json').write_text(json.dumps(result,indent=2)+'\n')
(evidence/'source-sha256-resume-v2.txt').write_text(''.join(v+'  '+p+'\n' for p,v in manifest.items()))
print(json.dumps(result,indent=2))
assert all(x['matches'] for x in protected)
assert all(x['matches'] for x in inverse.values())
assert all(not x['trailing_lines'] and x['final_newline'] for x in whitespace.values())
assert imports[paths[0]]==['node:crypto','@opencode-ai/schema/ftc-operation','@opencode-ai/schema/ftc-project','effect']
