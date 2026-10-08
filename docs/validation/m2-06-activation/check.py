import json,os,pathlib,subprocess,sys,time
root=pathlib.Path('/Users/dylanxu/coding_tree'); out=root/'docs/validation/m2-06-activation'
package,name,*args=sys.argv[1:]; env=dict(os.environ); base='/private/tmp/m2-06-activation-home'
for key,leaf in [('OPENCODE_TEST_HOME','home'),('XDG_DATA_HOME','data'),('XDG_CACHE_HOME','cache'),('XDG_CONFIG_HOME','config'),('XDG_STATE_HOME','state')]: env[key]=base+'/'+leaf
env.update(OPENCODE_DISABLE_MODELS_FETCH='true',OPENCODE_DISABLE_DEFAULT_PLUGINS='true',BUN_RUNTIME_TRANSPILER_CACHE_PATH='0')
env['PATH']='/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:'+env['PATH']
command=['/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun',*args]; start=time.monotonic()
with (out/(name+'.log')).open('w') as log: result=subprocess.run(command,cwd=root/'packages'/package,env=env,stdout=log,stderr=subprocess.STDOUT)
record=dict(package=package,command=command,exit=result.returncode,seconds=time.monotonic()-start,log=name+'.log')
with (out/'commands.jsonl').open('a') as f:f.write(json.dumps(record)+'\n')
print(json.dumps(record)); sys.exit(result.returncode)
