"""Prepare an owned, unchanged-upstream FTC build with three Java probes.
Usage: python prepare.py TOOL_CONFIG EXTRACTED_FTC_SOURCE NEW_PROJECT OUTPUT_CONFIG
The caller provisions/validates tools. No downloads, license acceptance or user-project edits.
"""
import json
import pathlib
import shutil
import sys

config = json.loads(pathlib.Path(sys.argv[1]).read_text())
root = pathlib.Path(sys.argv[3])
shutil.copytree(sys.argv[2], root)  # Refuse to overwrite any existing directory.
(root / 'local.properties').write_text('sdk.dir=' + config['sdk'] + '\n')
source = root / 'TeamCode/src/main/java/org/firstinspires/ftc/teamcode'
source.mkdir(parents=True, exist_ok=True)
config['cases'] = []
for name, imported, member, code in [
    ('FTC', 'com.qualcomm.robotcore.hardware.DcMotor', 'setPower', 'void sample(DcMotor motor) { motor.setPower(0.25); }'),
    ('Android', 'android.os.Build', 'SDK_INT', 'int sample() { return Build.VERSION.SDK_INT; }'),
    ('generated', 'com.qualcomm.ftcrobotcontroller.BuildConfig', 'DEBUG', 'boolean sample() { return BuildConfig.DEBUG; }'),
]:
    file = source / (name + 'Probe.java')
    file.write_text('package org.firstinspires.ftc.teamcode;\nimport ' + imported + ';\npublic class ' + name + 'Probe {\n  ' + code + '\n}\n')
    config['cases'].append(dict(name=name, path=str(file), use=imported.split('.')[-1], member=member, prefix=3))
config.update(root=str(root), mode='native')
pathlib.Path(sys.argv[4]).write_text(json.dumps(config, indent=2))
