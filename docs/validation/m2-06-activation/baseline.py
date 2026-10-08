import json, os, pathlib, subprocess, time
root = pathlib.Path('/Users/dylanxu/coding_tree')
out = root / 'docs/validation/m2-06-activation'
env = dict(os.environ)
base = pathlib.Path('/private/tmp/m2-06-activation-home')
for key, name in [('OPENCODE_TEST_HOME','home'),('XDG_DATA_HOME','data'),('XDG_CONFIG_HOME','config'),('XDG_CACHE_HOME','cache'),('XDG_STATE_HOME','state')]:
    path = base / name
    path.mkdir(parents=True, exist_ok=True)
    env[key] = str(path)
env.update(OPENCODE_DISABLE_MODELS_FETCH='true', OPENCODE_DISABLE_DEFAULT_PLUGINS='true', BUN_RUNTIME_TRANSPILER_CACHE_PATH='0')
bun = '/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun'
records = []
for package, name, args in [('opencode','baseline-legacy',['test','./test/effect/runner.test.ts','./test/background/job.test.ts']),('core','baseline-background',['test','./test/background-job.test.ts'])]:
    start=time.monotonic()
    with (out / (name+'.log')).open('w') as log:
        result=subprocess.run([bun,*args],cwd=root/'packages'/package,env=env,stdout=log,stderr=subprocess.STDOUT)
    records.append(dict(cwd=str(root/'packages'/package),command=[bun,*args],exit=result.returncode,seconds=time.monotonic()-start,log=name+'.log'))
(out/'baseline-commands.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps(records,indent=2))
