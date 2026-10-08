import os,sys,subprocess,pathlib,json,hashlib,datetime
root=pathlib.Path('/Users/dylanxu/coding_tree')
name,relative,*arguments=sys.argv[1:]
output=root/'docs/validation/m5-05/final'
output.mkdir(exist_ok=True)
env=os.environ.copy()
for key,child in [('OPENCODE_TEST_HOME','opencode'),('XDG_CONFIG_HOME','config'),('XDG_DATA_HOME','data'),('XDG_CACHE_HOME','cache'),('XDG_STATE_HOME','state')]:
    target=pathlib.Path('/private/tmp/m5-05-home')/child;target.mkdir(parents=True,exist_ok=True);env[key]=str(target)
command=['/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun',*arguments]
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
with (output/(name+'.log')).open('w') as stream:
    result=subprocess.run(command,cwd=root/relative,env=env,stdout=stream,stderr=subprocess.STDOUT)
record={'cwd':str(root/relative),'command':command,'exit':result.returncode,'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'environment':{key:env[key] for key in ['OPENCODE_TEST_HOME','XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_CACHE_HOME','XDG_STATE_HOME']}}
(output/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n')
print(name, 'exit',result.returncode)
print((output/(name+'.log')).read_text()[-3500:])
sys.exit(result.returncode)
