# Reused pinned reference evidence

No external requests were made for M6-03. Coordinates/import namespaces are from repository-owned M5-03 evidence, with no new compatibility claim.

- `docs/validation/java-import.md`: FTC RobotController v11.1, commit `203c2d373765f0c66d121e3ec1cc3a18835f6534`; SDK 11.1.0; Pedro core/ftc 2.1.2; Road Runner core 1.0.1; primary publication URLs and the prior real evaluation boundary.
- `docs/validation/m5-03/checksum-verification.json`: pinned `org.firstinspires.ftc:RobotCore:11.1.0`, `com.pedropathing:core:2.1.2`, `com.pedropathing:ftc:2.1.2`, `com.acmerobotics.roadrunner:core:1.0.1` and recorded checksum observations.
- `docs/validation/m5-03/shadow-pedro-result.json`: actual `com.pedropathing.geometry.Pose` definition into core-2.1.2.jar.
- `docs/validation/m5-03/shadow-roadrunner-result.json`: actual `com.acmerobotics.roadrunner.Pose2d` definition into core-1.0.1.jar.

Hashes of these existing evidence records are retained in `references.sha256`. Inline M6 tests use those observed coordinates and import namespace values; other versions are deliberate source-inspection fixtures, not compatibility assertions.
