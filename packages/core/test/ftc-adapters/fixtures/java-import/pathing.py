"""Create separate, owned FTC pathing examples from a compiling evaluation project.
Usage: python pathing.py BASE_CONFIG DESTINATION pedro|roadrunner OUTPUT_CONFIG
Only the selected pathing dependency is added; upstream build files otherwise stay intact.
"""
import json
import pathlib
import shutil
import sys

config = json.loads(pathlib.Path(sys.argv[1]).read_text())
root = pathlib.Path(sys.argv[2])
choice = sys.argv[3]
assert choice in ('pedro', 'roadrunner')
shutil.copytree(config['root'], root, ignore=shutil.ignore_patterns('build', '.gradle', '.project', '.classpath', '.settings', 'm503-classpath.json'))
for case in config['cases']:
    case['path'] = str(root / pathlib.Path(case['path']).relative_to(config['root']))
repo, dependency, imported, code, member = (
    ('https://maven.pedropathing.com/', 'com.pedropathing:ftc:2.1.2', 'com.pedropathing.geometry.Pose', 'double sample(Pose pose) { return pose.getX(); }', 'getX')
    if choice == 'pedro' else
    ('https://maven.brott.dev/', 'com.acmerobotics.roadrunner:core:1.0.1', 'com.acmerobotics.roadrunner.Pose2d', 'double sample(Pose2d pose) { return pose.position.x; }', 'position')
)
with (root / 'TeamCode/build.gradle').open('a') as file:
    file.write("\n// Owned M5-03 representative pathing fixture.\nrepositories { maven { url '" + repo + "' } }\ndependencies { implementation '" + dependency + "' }\n")
source = root / 'TeamCode/src/main/java/org/firstinspires/ftc/teamcode' / (choice + 'Probe.java')
source.write_text('package org.firstinspires.ftc.teamcode;\nimport ' + imported + ';\npublic class ' + choice + 'Probe {\n  ' + code + '\n}\n')
config['cases'].append(dict(name=choice, path=str(source), use=imported.split('.')[-1], member=member, prefix=3))
config.update(root=str(root), output=str(pathlib.Path(config['output']).with_name(choice + '-native-result.json')))
pathlib.Path(sys.argv[4]).write_text(json.dumps(config, indent=2))
