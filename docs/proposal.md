# FTC Programming Agent — Requirements Proposal

Status: Requirements agreed in conversation; written proposal awaiting user review.

Date: 2026-10-05

Scope: First-version requirements and technical direction. This document does not authorize product implementation.

Foundation: Adapt this repository's existing OpenCode desktop application and agent engine.

## 1. Purpose and success

Help FIRST Tech Challenge teams start programming more easily and help experienced programmers develop and debug robot code faster.

The application must bring environment setup, Java development, FTC-specific assistance, hardware-mapping code, robot deployment, debugging, and structured learning into one desktop workspace. A beginner completing the course should be capable of independently building a complete robot program covering driver control, mechanisms, and autonomous movement using their selected pathing library, including configuration, tuning, debugging, and deployment.

The application assists students with their own robot and project. It must ask for missing robot details instead of inventing hardware names, wiring, measurements, or tuning results. A successful build establishes that the project compiles; it does not establish that a physical robot behaves correctly.

### Intended users

| User | Required outcome |
| --- | --- |
| Student new to programming | Enter the course at an appropriate level, prepare the environment, understand generated code, and progress toward a complete robot program. |
| Student familiar with Java but new to FTC | Skip familiar material and learn FTC concepts, libraries, project structure, and robot workflows. |
| Experienced FTC programmer | Open an existing project, edit Java directly, use AI assistance, and diagnose problems using build output, available robot logs, and live telemetry. |

### Terms used in this document

- **Agent:** the AI assistant together with tools for inspecting files, editing code, running builds, and performing permitted robot operations.
- **Model:** the AI system used by the agent, accessed through an online provider or run locally on the user's computer.
- **Project:** a local FTC project folder and its associated application configuration and chats.
- **Chat:** a conversation with its own history inside a project. Chats in one project share that project's files.
- **Robot Controller:** the REV Control Hub or compatible Android phone that runs the robot program.
- **Driver Station:** the FTC application used to configure and operate the robot, including when running on a REV Driver Hub.
- **Telemetry:** measurements or status information actually published by the robot program.
- **ADB:** Android Debug Bridge, used to communicate with and install software on a controller over USB or Wi-Fi.

## 2. Agreed first-version scope

| Area | Decision |
| --- | --- |
| Product form | Standalone desktop application for macOS and Windows. |
| Programming | Java with the FTC SDK. |
| OpenCode approach | Adapt the existing desktop application, retaining its agent and chat foundation. |
| Project lifecycle | Create new projects and open existing FTC Java projects. |
| Organization | Multiple projects; multiple persistent chats within each project. |
| Concurrency | One active agent chat per project; different projects may run concurrently. |
| Workspace | Switch between AI chat only and AI chat alongside an IDE-style Java editor. |
| Initial environment setup | User chooses automatic or guided setup at startup. |
| Online AI | Teams supply their own provider API keys and manage provider usage costs. |
| Offline AI | User-selectable local inference, with app-managed setup and connection to existing local AI services. |
| Code changes | User-selectable plan-before-editing or direct editing and build checks. |
| Hardware definitions | Driver Station-style form and chat operate on the same project configuration; generate Java mappings only. |
| Pathing libraries | PedroPathing, Road Runner, or neither initially; explain advantages during project creation. |
| Pathing exclusivity | At most one application-managed pathing library per project. This is a product rule, not a claim of universal technical incompatibility. |
| Dashboard | FTControl Panels embedded when validated; separate dashboard plus setup assistance if embedding proves incompatible. |
| Robot diagnostics | Agent-readable live telemetry, available robot logs, and build output. |
| Robot actions | User-selectable observation only or agent actions with explicit approval. |
| Controllers and connections | REV Control Hub and compatible phone-based Robot Controllers; USB and Wi-Fi, with connection guidance. |
| Deployment approval | Each installation is initiated by the user or explicitly approved. |
| Learning | Project-based assistance plus structured lessons, exercises, multiple entry levels, and saved progress. |
| Languages | English and Simplified Chinese throughout the interface, course, and AI explanations. |

All capabilities above belong to the first version, subject to the explicitly agreed dashboard-display fallback. Implementing them in stages does not remove them from the release requirements.

Outside this version are Blocks programming, writing or synchronizing the robot's actual hardware-configuration file, and an application-operated AI access or billing service. Additional languages are planned for later development. Other future capabilities require a separate scope decision.

## 3. Functional requirements

“Must” identifies a first-version requirement. Requirement IDs provide references for acceptance and implementation planning.

### 3.1 Projects, chats, and workspace

| ID | Requirement |
| --- | --- |
| PRJ-01 | The application must create new FTC Java projects and open existing ones from local folders. It must inspect existing SDK versions, dependencies, and structure before proposing changes. Opening a project must preserve its code and configuration. |
| PRJ-02 | Users must be able to work with multiple projects and create multiple chats under each project. Each chat must retain a separate conversation history while operating on the project's shared files. |
| PRJ-03 | Project associations and chat histories must persist across application restarts. Switching projects or chats must not mix their conversation histories or project-specific context. |
| PRJ-04 | At most one agent chat may run within a project at a time. Other projects may run independently. A busy project must identify its active chat; users may draft messages elsewhere, but must wait for the active run to finish or stop it before starting another chat's run. A draft must not execute automatically when the project becomes idle. |
| PRJ-05 | Users must be able to switch between chat-only and chat-plus-editor layouts without losing the current project, conversation, or unsaved editing state. Layout choice must not change AI mode or action permissions. |
| EDT-01 | The editor must support opening, editing, and saving Java files, syntax highlighting, code completion, inline diagnostics, and navigation to definitions using the project's dependencies. |
| EDT-02 | Editor diagnostics and build results must be available to the agent. Loading, unavailable, or failed language tooling must be distinguishable from a file with no reported errors. |

Chats are not separate copies of the robot project. The concurrency rule prevents two agent chats from editing that project simultaneously; it does not remove the need to preserve changes made manually by the user.

### 3.2 Environment and project setup

| ID | Requirement |
| --- | --- |
| ENV-01 | At startup, users must be offered automatic or guided development-environment setup. Both paths must detect existing tools and explain what is missing or incompatible. |
| ENV-02 | Automatic setup must download and configure the required Java and Android development tools and project dependencies, presenting any system permissions or required user steps. It must report failed steps and a way to recover. |
| ENV-03 | Guided setup must provide actionable installation instructions, detect when prerequisites become available, and verify readiness before marking setup complete. |
| ENV-04 | Setup must prepare the FTC SDK project, build tooling, and ADB required by the selected compatibility profile. It must verify readiness with a build and expose its actual result. Completion must not imply that robot hardware has been tested. |
| ENV-05 | Existing projects must retain their current configuration until a necessary change is explained and applied under the selected code-change workflow. The application must not silently upgrade the FTC SDK or replace a team's code to fit a template. |
| ENV-06 | Once required tools, dependencies, models, and reference materials are available locally, editing, building, learning, deployment, and robot-network access must remain usable without internet access. Missing cached resources must be identified rather than represented as available offline. |

The Java runtime required by editor tooling may differ from the runtime required to build an FTC project. Setup must account for both without assuming one global Java installation satisfies every tool. Exact versions are governed by the tested compatibility matrix in Section 7.

### 3.3 AI access and coding behavior

| ID | Requirement |
| --- | --- |
| AI-01 | Users must be able to configure their own online AI provider credentials and choose a supported model. The application must explain that provider usage is managed through the team's own account. |
| AI-02 | Users must be able to choose online or offline AI. The selected mode must be visible. Offline AI processing must stay on the user's computer and must not silently fall back to an online provider. |
| AI-03 | Offline setup must offer model selection and download, start/stop controls for app-managed inference, and connection to an already configured local AI service. Model storage and computer-resource requirements must be explained before setup. |
| AI-04 | Users must choose between plan-before-editing and direct work. Plan-before-editing must explain the intended changes and wait for approval before editing. Direct work may edit and run local build checks in response to the user's request, then explain the changes and results. |
| AI-05 | The agent must use the current project's code, hardware definitions, SDK and library versions, relevant documentation, and available diagnostics. Missing facts must result in questions or explicitly stated limits, not invented configuration or measurements. |
| AI-06 | Online mode must explain that relevant code and telemetry may be sent to the selected provider. Offline assistance must use local inference and locally available references; unavailable online knowledge must be identified. |
| AI-07 | The application must distinguish model/provider failure, unsupported tool use, build failure, and robot-operation failure. It must not describe an intended action as completed when its tool did not succeed. Tested local models must be identified; arbitrary local models must not be promised equivalent agent capability. |

The code-change setting does not authorize deployment, robot program starts, or live tuning changes. Those actions follow the separate requirements in Section 3.7.

### 3.4 FTC knowledge and libraries

| ID | Requirement |
| --- | --- |
| FTC-01 | Assistance must cover the FTC SDK, OpMode lifecycle, hardware access, gamepad input, telemetry, driver-controlled programming, mechanisms, autonomous programming, tuning, debugging, and deployment. It must teach understandable code organization and explain generated code. |
| FTC-02 | New-project creation must offer PedroPathing, Road Runner, and “Neither—choose later.” The chooser must explain each library's documented advantages, prerequisites, and setup/tuning workflow in the selected language. It must not claim one is universally superior. |
| FTC-03 | The application must help install, configure, explain, generate code for, and debug the selected pathing library. A project that chose neither must be able to select one later. The application must not add both libraries as its managed pathing choices. |
| FTC-04 | Importing a project must detect its existing pathing choice. If dependencies or code indicate conflicting choices, the agent must ask how the user wants to resolve them rather than silently removing or migrating code. |
| FTC-05 | FTControl Panels installation, configuration, and code assistance must be supported. Road Runner's documented FTC Dashboard dependency and tuning utilities must be retained where required; Panels must not be assumed to replace them. |
| FTC-06 | Knowledge and examples must identify their applicable SDK/library versions. Selected reference documentation must be available locally for offline use. Updates must preserve the distinction between the user's installed version and newer upstream examples. |

#### Content required in the pathing chooser

The following are source-grounded comparison points, not performance measurements made for this application:

| Choice | Advantages to explain | Information the student also needs |
| --- | --- | --- |
| PedroPathing | Its current documentation describes time-independent path following, correction after disturbances, dynamic path creation, and a visualizer for generating paths, including Bézier curves. | Explain the supported robot setup and tuning process for the selected PedroPathing version. A supplied path or generated program still needs validation on the student's robot. |
| Road Runner | Its Actions model composes reusable robot behaviors sequentially or concurrently, helping coordinate drivetrain and mechanism operations. Its FTC quickstart supplies drive and tuning utilities. | Explain the selected version's drive/localization setup and tuning sequence, including FTC Dashboard where required. Avoid mixing examples from incompatible Road Runner versions. |
| Neither—choose later | Allows initial work on Java, hardware access, and driver control without immediately configuring a pathing library. | The student must choose a pathing library before taking the corresponding library-specific autonomous course track. |

Sources: [PedroPathing introduction](https://pedropathing.com/docs/pathing), [PedroPathing installation](https://pedropathing.com/docs/pathing/installation), [Road Runner Actions](https://rr.brott.dev/docs/v1-0/actions/), [Road Runner installation](https://rr.brott.dev/docs/v1-0/installation/), and [Road Runner tuning](https://rr.brott.dev/docs/v1-0/tuning/). The comparison must be reviewed when the application changes supported versions.

### 3.5 Hardware-mapping assistance

| ID | Requirement |
| --- | --- |
| HW-01 | Provide a visual hardware form following the FTC Driver Station's Configure Robot layout and organization: hubs, device categories, numbered ports, device types, and device names. Its desktop presentation must remain recognizable to a student familiar with that interface. |
| HW-02 | The visual form and chat must read and update one shared set of project hardware definitions. A change through either interface must be visible through the other, with validation for missing or conflicting definitions. |
| HW-03 | The agent must generate or update Java hardware-mapping code from those definitions, following the selected code-change workflow. Existing custom code must be inspected before modification; names and relevant code references must remain consistent. |
| HW-04 | The application must explain which physical-robot configuration steps the student must perform through the Driver Station. It must not write, synchronize, or claim to have changed the Robot Controller's hardware-configuration file. |

The shared configuration here is a project-side description used for code assistance. It is not evidence that a device is physically connected to the stated port. The official configuration workflow is documented in [FTC's hardware configuration guide](https://ftc-docs.firstinspires.org/en/latest/hardware_and_software_configuration/configuring/getting_started/getting-started.html).

### 3.6 Dashboard and diagnostic data

| ID | Requirement |
| --- | --- |
| PAN-01 | Display FTControl Panels alongside the development workspace if the embedding approach passes validation on macOS and Windows. If embedding proves incompatible, provide setup/coding assistance and open the dashboard separately. |
| PAN-02 | Provide an agent-readable telemetry connection in addition to displaying the dashboard. This capability must remain available when the dashboard uses the separate-window fallback. |
| PAN-03 | Telemetry supplied to the agent must identify its source robot/project and freshness. Disconnected or old readings must be marked accordingly. The agent must distinguish absent telemetry from a valid zero reading. |
| PAN-04 | The agent must be able to use build output and available robot logs with telemetry to explain a problem, suggest changes, and assess new observations. It must identify when more measurements or a physical test are needed. |

Displaying the Panels webpage alone does not satisfy PAN-02. The application needs a separate, version-aware way to obtain the relevant data. It can only observe information the robot or its installed integrations actually expose.

### 3.7 Robot connections, deployment, and actions

| ID | Requirement |
| --- | --- |
| ROB-01 | Support REV Control Hubs, including configurations with attached Expansion Hubs, and compatible Android phone-based Robot Controllers. Guide users through USB and Wi-Fi connection setup, device authorization, selection, and connection recovery. |
| ROB-02 | Build and install the FTC Robot Controller application through the normal Android/FTC toolchain and ADB. Before installation, identify the selected project, target controller, and build result. A failed build must not be reported or used as a successful new deployment. |
| ROB-03 | Each deployment must follow a deliberate user action: pressing Deploy or approving the agent's specified deployment request. Approval of code changes or selection of direct-work mode does not authorize an installation. |
| ROB-04 | Offer observation-only and actions-with-approval modes for the agent. Observation-only permits diagnosis and recommendations while the student operates the robot. Actions-with-approval permits agent-requested program initialization/start or live tuning changes only after explicit approval of the particular action. |
| ROB-05 | Prevent overlapping deployments or control actions from different projects within this application to the same robot. Associate telemetry, pending approvals, and operation results with the selected controller so that changing projects cannot redirect an approved action. |
| ROB-06 | On connection loss, identify the failure, mark affected data unavailable/stale, and give recovery steps. Reconnection must not automatically start a program, repeat a tuning change, or replay a previous deployment. A lost connection must not be represented as confirmation that the robot stopped. |
| ROB-07 | Robot-action permissions must apply to agent-initiated operations regardless of whether they originate from chat, dashboard integration, or a command tool. The code-editing mode must not provide an alternative route around robot-action approval. |

ADB supports both USB and wireless transport; “ADB” and “wired connection” are not alternative deployment technologies. See [Android's ADB documentation](https://developer.android.com/tools/adb) and [FTC's Control Hub guidance](https://ftc-docs.firstinspires.org/en/latest/programming_resources/shared/managing_control_hub/Managing-a-Control-Hub.html).

FIRST's current guidance identifies REV Control Hubs and Driver Hubs as its officially supported devices. Phone support in this application therefore requires a documented, tested compatibility list; it must not imply that FIRST guarantees every Android phone. See [FTC's supported control-system setup](https://ftc-docs.firstinspires.org/en/latest/programming_resources/android_studio_java/before_you_start/before-you-start.html).

### 3.8 Learning and languages

| ID | Requirement |
| --- | --- |
| LRN-01 | Provide contextual teaching within a student's project and a structured course containing lessons, exercises, and saved progress. Students must be able to choose an entry level and skip familiar material. |
| LRN-02 | Cover Java fundamentals where needed; FTC concepts and code organization; driver control; mechanisms; autonomous programming with the selected pathing library; configuration; tuning; debugging; and deployment. |
| LRN-03 | Explain the purpose and structure of generated code. Exercises must require students to apply concepts to their project, not merely copy an answer without understanding its role. |
| LRN-04 | Provide separate PedroPathing and Road Runner course tracks where their workflows differ. A learner who initially chose neither must be guided to make a choice when entering library-specific autonomous work. |
| LRN-05 | Course materials and saved progress must remain usable locally. Course completion must distinguish code/build exercises from activities requiring real robot measurements or testing. The final outcome is an independently developed complete robot program, not only lesson-page completion. |
| LNG-01 | Provide English and Simplified Chinese for application interfaces, setup guidance, course content, and AI explanations. Preserve code identifiers, API names, and device names where translation would change their meaning. |
| LNG-02 | Organize interface strings and course content so additional languages can be added later. Additional languages are not first-version completion requirements. |

## 4. Core user journeys

### First project

1. Start the application and select language and automatic or guided environment setup.
2. Select online AI with the team's provider credentials or offline AI through managed setup or an existing local service.
3. Create an FTC Java project. Compare PedroPathing and Road Runner, or choose neither for now.
4. Define the robot hardware using the familiar form, conversation, or both; complete physical configuration separately on the Driver Station.
5. Choose a course entry level or begin a coding task. Use chat only or show the editor alongside it.
6. Review the plan when using plan-before-editing, or let direct-work mode edit and check the code. Read the explanation and actual build results.
7. Follow connection guidance, select the intended controller, and explicitly initiate or approve deployment.
8. Operate the robot as a student or approve a specific agent action, then inspect telemetry and logs to inform the next change.

This sequence describes available steps, not a requirement to repeat completed setup on every launch. The startup setup choice must reuse detected readiness rather than reinstall working tools.

### Existing team project

Open the existing folder, inspect the SDK and installed libraries, and retain the team's files. Explain incompatibilities before proposing changes. Create separate chats for different work while enforcing one active agent chat in that project. Work in other projects concurrently without mixing files, chat context, or robot targets.

### Offline work

Prepare the required model, toolchain, dependencies, lessons, and selected references while downloads are available. Select offline AI and continue local development. A connection to the robot's network may still be required for telemetry or wireless deployment; absence of internet does not mean absence of a local robot connection. Report missing local resources and do not silently contact an online model.

## 5. Technical direction and boundaries

### Selected approach

Extend the existing OpenCode desktop app rather than create a separate frontend around its API. Reuse its conversation, model-provider, tool-execution, and permission foundations where they satisfy these requirements. Keep FTC-specific responsibilities identifiable so future upstream changes can be assessed without an unrelated rewrite of the agent engine.

These are logical responsibilities, not prescribed new packages or a detailed implementation plan:

| Component | Responsibility | Inputs and boundaries |
| --- | --- | --- |
| Desktop workspace | Project/chat organization, layout switching, editor, forms, dashboard area, lessons, and visible statuses. | Uses the application/backend interfaces; does not itself decide whether a robot action is authorized. |
| OpenCode agent foundation | Conversation history, model calls, context assembly, and tool execution under the user's choices. | Receives project-specific context and calls explicit development/robot tools. Reuses the existing session lifecycle. |
| Environment and project setup | Detect tools, prepare supported toolchains/dependencies, inspect imports, and verify builds. | Uses versioned compatibility information and preserves existing project state. |
| Java development tools | Editing services, dependency-aware completion/navigation, diagnostics, and builds. | Operate on the active project; language-service readiness and build success remain separate results. |
| FTC project configuration | Shared hardware definitions and pathing-library selection. | Supplies the form, chat, and code-generation workflows; does not write robot-side hardware configuration. |
| Robot integration | Controller selection, ADB deployment, Panels access, telemetry/log reading, and approved control actions. | Enforces target identity, action approval, and coordination between projects. Dashboard display and data access are separate functions. |
| Knowledge and learning | Version-appropriate references, bilingual lessons, exercises, entry levels, and saved progress. | Distinguishes documented facts, project facts, and observations from a physical robot. |
| Local AI management | Model downloads, app-managed runtime lifecycle, or connection to an existing service. | Supplies a local model endpoint to the agent; does not silently switch to a cloud endpoint. |

### Data flow

The selected chat receives the user's request. The agent uses that project's files, hardware definitions, compatible references, and available diagnostic data. It calls the chosen online or local model and executes resulting tool requests under the applicable permissions. Tool results update the conversation and relevant views. Form and chat changes converge on the same project hardware definitions.

In online mode, the relevant context may be transmitted to the selected provider. In offline mode, AI processing stays local. Provider credentials must be protected and excluded from model context and diagnostic output.

Independent settings must remain independent:

| Setting | What it controls | What it does not authorize |
| --- | --- | --- |
| Chat only / chat plus editor | Workspace presentation. | A different model, changed permissions, or another agent run. |
| Online / offline AI | Where AI inference occurs. | Automatic fallback to another inference location. |
| Plan first / direct work | How requested code edits and local build checks begin. | Deployment, program starts, or live tuning. |
| Observation / actions with approval | Whether the agent may request robot control actions. | Blanket approval of later actions. |
| Deploy button / deployment approval | Installation of the specified build on the selected robot. | Starting a robot program afterward. |

### Repository constraints

Implementation must follow the root `AGENTS.md` and applicable package instructions. In particular:

- Preserve Schema/Core/Protocol/Server dependency boundaries; Client runtime code must not import Core or Server.
- Regenerate clients after public Protocol or Server HttpApi changes; do not edit generated clients directly.
- Preserve V2 durable prompt admission, process-global Session execution, Location-scoped runtime services, and one provider-stream call per provider turn. Add project-level concurrency coordination without replacing those lifecycle guarantees or collapsing all project chats into one Session.
- Enforce concurrency in the backend as well as the interface; duplicate views of the same project must not bypass it.
- Follow existing desktop IPC and typed localization patterns. Run checks from the relevant package directories using repository commands.

## 6. FTControl Panels feasibility finding

**Conclusion:** embedding the existing dashboard is a viable technical direction based on source and documentation inspection. It has not been implemented or tested with a physical robot in this requirements work.

The inspected OpenCode checkout, `907b3bc518fa48e90e8ec24dd327d13eee71c36c`, uses Electron for the desktop app. Electron's `WebContentsView` provides an embedded browser surface suitable for loading a separate webpage. The intended approach is a distinct browser view for the robot dashboard, with no access to the application's privileged preload/API bridge, following Electron's isolation guidance.

FTControl Panels source was inspected at `11d69a98e39c43a7d9edc5932275897c034f7a30`. Its robot-side code serves the web interface on port 8001 and opens its WebSocket server on port 8002. Its access guide documents both Control Hub and phone-controller URLs. These observations support loading the robot-served interface rather than rewriting the dashboard.

| Finding | Evidence status | Required follow-through |
| --- | --- | --- |
| OpenCode provides an Electron desktop foundation. | Verified in this repository's desktop README, package manifest, and window code. | Integrate the dashboard surface without changing unrelated desktop behavior. |
| Panels exposes a web interface and a separate socket service. | Verified from the pinned upstream server and setup sources. | Verify actual page loading, plugin resources, live updates, and reconnect behavior against supported Panels versions. |
| Electron offers a browser-view embedding API. | Verified in official Electron documentation. | Validate sizing, focus, navigation, isolation, and lifecycle on both supported desktop platforms. |
| The agent can obtain typed diagnostic data independently of the view. | Required product capability; the exact adapter has not been validated. | Verify the supported Panels protocol/plugin path and its version handling. Do not equate page display with agent data access. |
| USB can carry the required dashboard/data connections through an integration strategy such as ADB forwarding. | Candidate technical approach, not verified by a robot test. | Verify all necessary endpoints and resources for the chosen version. A successful USB app installation alone does not prove USB telemetry works. |

If embedded display cannot pass compatibility testing, use the agreed external-dashboard fallback. That fallback changes where the dashboard is displayed; it does not remove the requirements for setup assistance, agent-readable telemetry, or approved robot actions. Failure of those capabilities requires resolution or a new user scope decision, not an implicit downgrade.

Primary technical references:

- [Panels server initialization at the inspected revision](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/library/Panels/src/main/java/com/bylazar/panels/Panels.kt)
- [Panels static server](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/library/Panels/src/main/java/com/bylazar/panels/server/StaticServer.kt)
- [Panels socket server](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/library/Panels/src/main/java/com/bylazar/panels/server/Socket.kt)
- [Panels connection guide](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/library/Docs/web/src/docs/Accessing.svelte)
- [Panels setup guide](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/library/Docs/web/src/docs/Prerequisites.svelte)
- [Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)
- [Electron remote-content isolation](https://www.electronjs.org/docs/latest/tutorial/security)

## 7. Compatibility and acceptance

### Compatibility policy

Before release, publish and test a compatibility matrix covering macOS/Windows versions and architectures, Java/build/editor toolchains, FTC SDK releases, pathing-library and dashboard versions, supported controller setups, and tested online/local AI configurations. New-project setup must use combinations from that matrix rather than independently selecting every dependency's newest version.

Existing projects outside the tested matrix must receive a clear compatibility explanation. Their code and configuration must not be silently replaced. Exact package versions, operating-system minima, the editor library, managed inference runtime, model recommendations, and persistence schema are implementation-design decisions requiring evaluation; this proposal does not invent selections or claim those integrations already work.

### Acceptance scenarios

Each scenario is a release check, not a test result from this requirements-writing task.

| Check | Requirements | Passing evidence |
| --- | --- | --- |
| AC-01: New environment | ENV-01–ENV-04 | On documented macOS and Windows configurations without the required tools, both setup choices lead to a buildable Java FTC project. A deliberately failed setup step reports its cause and recovery path. |
| AC-02: Existing project | PRJ-01, ENV-05, FTC-04 | Opening a representative team project preserves its files and detects its SDK/dependencies. Required changes and conflicting pathing choices are explained before modification. |
| AC-03: Project/chat organization | PRJ-02–PRJ-04 | Two projects retain separate histories after restart. Two chats in one project cannot run together, a second project can run, busy status identifies the active chat, and unsent drafts never execute automatically. |
| AC-04: Editor and layouts | PRJ-05, EDT-01–EDT-02 | Java completion, diagnostics, and definition navigation resolve project/SDK symbols. A known error is visible to the user and agent. Layout changes preserve work and tool failures are visible. |
| AC-05: Online AI and code modes | AI-01, AI-04–AI-07 | A configured provider can assist on a real project. Plan-first waits for approval; direct work edits/builds as requested. Both explain results and report unavailable information or failed tools honestly. |
| AC-06: Offline AI and prepared offline work | ENV-06, AI-02–AI-03, AI-06–AI-07 | App-managed inference and an existing local service each complete supported agent tasks. With internet unavailable and required assets cached, editing, building, learning, and local robot work remain available. There is no silent online-model fallback. |
| AC-07: Library choices | FTC-01–FTC-06 | New-project flows for PedroPathing, Road Runner, and neither produce expected dependencies and successful builds. Adding a pathing library later works. Comparisons match selected-version documentation, and Road Runner retains required tuning tools. |
| AC-08: Shared hardware definitions | HW-01–HW-04 | A form change is visible to chat and a chat change is visible in the form. Generated Java uses the agreed names/types, invalid definitions are explained, and no robot-side hardware configuration is written. |
| AC-09: Dashboard and diagnostics | PAN-01–PAN-04 | The integrated view passes platform checks or the external fallback is documented. The agent reads actual telemetry and available logs in either display mode. Disconnect tests mark stale data and do not fabricate readings. |
| AC-10: Controller connections and deployment | ROB-01–ROB-03 | Real deployment succeeds on tested Control Hub and phone setups over USB and Wi-Fi from macOS and Windows. The correct target/build is shown and explicit deployment approval is enforced. |
| AC-11: Robot action boundaries | ROB-04–ROB-07 | Observation mode prevents agent-issued control actions. Approval mode executes only the approved action on its intended robot. Cross-project conflicts are prevented; disconnect/reconnect does not replay commands. |
| AC-12: Learning outcome | LRN-01–LRN-05 | Entry-level selection, exercises, and progress restoration work. Each pathing track supports a capstone covering driver control, a mechanism, and autonomous motion, with student-performed configuration, tuning, diagnosis, and deployment. Review includes the student's explanation and independent application of the code. |
| AC-13: Bilingual experience | LNG-01–LNG-02 | Both languages cover setup, workspace, device operations, errors, lessons, and explanations. Switching language preserves progress, identifiers, and project state. Localization review verifies terminology in context. |

For robot-dependent checks, record the operating system, controller, connection method, SDK/library versions, and relevant model used. Cover both pathing tracks and both controller/transport types across the documented supported combinations. Record computer-only evidence separately from physical robot results.

Telemetry and robot-control checks must include target changes, disconnects, and data freshness. Offline checks must distinguish lack of internet from loss of the robot's local connection. A screenshot of a dashboard or a successful compilation alone cannot satisfy these integration checks.

## 8. Delivery organization

The approved scope spans several substantial components. It can be developed in the following coordinated stages, with detailed implementation plans created separately after review of this proposal:

| Stage | Scope | Completion evidence |
| --- | --- | --- |
| Workspace and AI foundation | OpenCode desktop adaptation, project/chat organization, execution coordination, online/local AI selection, and both layouts. | Relevant organization and AI acceptance checks pass. |
| FTC development workflow | Automatic/guided environment setup, new/existing projects, Java editor, library setup, and shared hardware definitions. | Projects build and editor/configuration checks pass. |
| Robot integration | USB/Wi-Fi guidance, ADB deployment, dashboard display, agent-readable diagnostics, and action approval. | Real-controller integration and failure-path checks pass on both platforms. |
| Learning and release integration | Course entry levels, both pathing tracks, exercises, progress, offline materials, bilingual coverage, and full compatibility testing. | Course outcome and all remaining acceptance checks pass. |

These stages organize implementation; they are not a reduction of first-version scope. A stage must not be described as the complete first release while approved requirements remain unfinished. The current task ends with the requirements document and its review, without starting product implementation or a detailed implementation plan.

## 9. Source and decision record

Product decisions in Sections 1–4 were confirmed through the requirements conversation. The user approved adapting OpenCode and all five reviewed requirement sections: project organization; setup/libraries/hardware mapping; AI/learning; deployment/debugging; and technical structure/scope/verification.

Research establishes technical direction and constraints, not completed product functionality. Sources inspected during this work include:

| Source | Use |
| --- | --- |
| [Root repository instructions](../AGENTS.md) | Package boundaries, generation rules, and Session V2 constraints. |
| [OpenCode desktop README](../packages/desktop/README.md), [manifest](../packages/desktop/package.json), and [window implementation](../packages/desktop/src/main/windows.ts) | Confirm the Electron foundation and existing desktop boundaries. |
| [Client package](../packages/client/README.md) and [SDK-next package](../packages/sdk-next/README.md) | Understand existing integration boundaries; avoid treating transitional client surfaces as a new product design. |
| [Provider documentation](../packages/web/src/content/docs/providers.mdx) and [language-server documentation](../packages/web/src/content/docs/lsp.mdx) | Existing online/local provider paths and Java tooling foundations; these do not by themselves establish a complete IDE or managed local-model experience. |
| [PedroPathing repository](https://github.com/Pedro-Pathing/PedroPathing) and [documentation](https://pedropathing.com/docs/pathing) | Requested library and its setup/comparison reference. |
| [Road Runner repository](https://github.com/acmerobotics/road-runner) and [tuning documentation](https://rr.brott.dev/docs/v1-0/tuning/) | Requested library, tuning workflow, and supporting dependencies. |
| [FTControl Panels repository](https://github.com/ftcontrol/ftcontrol-panels) and [documentation](https://panels.bylazar.com/) | Requested dashboard, Java support, and integration investigation. |
| Official FTC, Android, and Electron sources linked above | Hardware configuration, connection/deployment workflows, supported-device distinctions, and embedding direction. |

The descriptive title “FTC Programming Agent” identifies this proposal's subject; it is not an agreed product brand. No unrequested deadline, budget, performance target, exact model, or package-version selection is asserted here.
