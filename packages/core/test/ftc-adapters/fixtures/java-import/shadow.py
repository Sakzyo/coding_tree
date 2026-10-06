"""Build an owned Eclipse shadow from an actual Gradle JavaCompile snapshot.
Usage: python shadow.py CONFIG SHADOW_DIRECTORY OUTPUT_CONFIG
No dependency invention: classpath entries and generated BuildConfig come from Gradle output.
"""
import hashlib
import json
import pathlib
import shutil
import sys
import xml.etree.ElementTree as ET

config = json.loads(pathlib.Path(sys.argv[1]).read_text())
source = pathlib.Path(config['root'])
root = pathlib.Path(sys.argv[2])
root.mkdir()  # Refuse to overwrite an existing project.
snapshot = json.loads((source / 'm503-classpath.json').read_text())
project = ET.Element('projectDescription')
ET.SubElement(project, 'name').text = root.name
build = ET.SubElement(ET.SubElement(project, 'buildSpec'), 'buildCommand')
ET.SubElement(build, 'name').text = 'org.eclipse.jdt.core.javabuilder'
ET.SubElement(ET.SubElement(project, 'natures'), 'nature').text = 'org.eclipse.jdt.core.javanature'
ET.ElementTree(project).write(root / '.project', encoding='unicode')
classpath = ET.Element('classpath')
ET.SubElement(classpath, 'classpathentry', kind='src', path='src')
ET.SubElement(classpath, 'classpathentry', kind='src', path='generated')
ET.SubElement(classpath, 'classpathentry', kind='con', path='org.eclipse.jdt.launching.JRE_CONTAINER/org.eclipse.jdt.internal.debug.ui.launcher.StandardVMType/JavaSE-17')
manifest = []
for index, entry in enumerate(snapshot['classpath'] + snapshot['boot']):
    original = pathlib.Path(entry)
    copied = root / 'lib' / (str(index) + '-' + original.name)
    copied.parent.mkdir(exist_ok=True)
    shutil.copy2(original, copied)
    ET.SubElement(classpath, 'classpathentry', kind='lib', path=str(copied.relative_to(root)))
    manifest.append({'original': str(original), 'copied': str(copied), 'sha256': hashlib.sha256(copied.read_bytes()).hexdigest()})
ET.SubElement(classpath, 'classpathentry', kind='output', path='bin')
ET.ElementTree(classpath).write(root / '.classpath', encoding='unicode')
for case in config['cases']:
    original = pathlib.Path(case['path'])
    copied = root / 'src/org/firstinspires/ftc/teamcode' / original.name
    copied.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(original, copied)
    case['path'] = str(copied)
original = source / 'FtcRobotController/build/generated/source/buildConfig/debug/com/qualcomm/ftcrobotcontroller/BuildConfig.java'
copied = root / 'generated/com/qualcomm/ftcrobotcontroller/BuildConfig.java'
copied.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(original, copied)
manifest.append({'original': str(original), 'copied': str(copied), 'sha256': hashlib.sha256(copied.read_bytes()).hexdigest()})
(root / 'provenance.json').write_text(json.dumps(manifest, indent=2))
config.update(root=str(root), mode='classpath', output=str(pathlib.Path(config['output']).with_name(root.name + '-result.json')))
pathlib.Path(sys.argv[3]).write_text(json.dumps(config, indent=2))
