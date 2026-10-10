import subprocess, pathlib, json, hashlib, os, sys
root=pathlib.Path('/Users/dylanxu/coding_tree')
evidence=root/'docs/validation/m9-02/implementation-2026-10-10'
name, package, *argv=sys.argv[1:]
env=os.environ.copy()
env.update({key:'/private/tmp/m9-02-2026-10-10-home/'+key.lower() for key in ['OPENCODE_TEST_HOME','XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_CACHE_HOME','XDG_STATE_HOME']})
env['PATH']='/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:'+env['PATH']
with (evidence/(name+".log")).open("wb") as output:
 result=subprocess.run(argv,cwd=root/package,env=env,stdout=output,stderr=subprocess.STDOUT,timeout=60)
result.stdout=(evidence/(name+".log")).read_bytes()
assert len(result.stdout)<2_000_000, 'Output bound exceeded; full output retained in memory'
(evidence/(name+'.log')).write_bytes(result.stdout)
meta={'argv':argv,'cwd':str(root/package),'exit':result.returncode,'environment':{key:env[key] for key in ['OPENCODE_TEST_HOME','XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_CACHE_HOME','XDG_STATE_HOME']},'log_sha256':hashlib.sha256(result.stdout).hexdigest(),'source_sha256':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['packages/core/src/ftc/operations.ts','packages/schema/src/ftc-operation.ts','packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts','packages/core/test/ftc/robot-approvals-and-operations/m9-02.test.ts'] if (root/p).exists()}}
(evidence/(name+'.json')).write_text(json.dumps(meta,indent=2)+'\n')
print(result.stdout.decode());print('EXIT',result.returncode)
