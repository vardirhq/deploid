# CLI Reference

This reference describes Deploid 2.0 command behavior.

## Global Options

| Option | Description |
| --- | --- |
| `-V, --version` | Output version |
| `-h, --help` | Display help |

## Core Commands

### `deploid doctor`

Audit project, workflow, release, plugin, and tooling readiness.

```bash
deploid doctor [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--json` | `boolean` | `false` | Output machine-readable JSON report |
| `--markdown` | `boolean` | `false` | Output a markdown report suitable for issues/PRs |
| `--ci` | `boolean` | `false` | Output concise `key=value` lines for CI logs |
| `--summary` | `boolean` | `false` | Show workflow summary and non-passing checks only |
| `--verbose` | `boolean` | `false` | Include passing checks and extra detail lines |
| `--project-only` | `boolean` | `false` | Skip environment/toolchain checks and inspect project files only |
| `--fix` | `boolean` | `false` | Apply safe automatic fixes and rerun the audit |
| `--debug` | `boolean` | `false` | Enable debug logging |

#### What It Checks

- Project setup: config presence, build command, asset source, generated outputs
- Build readiness: Capacitor config, Android project, Gradle wrapper, SDK/toolchain
- Release readiness: signing, version metadata, Play/GitHub publishing config
- Deploy readiness: ADB presence and connected device state
- Desktop readiness: Electron scripts/dependencies and package metadata consistency
- Config drift between `deploid.config.*`, `capacitor.config.json`, Gradle, and `package.json`

#### Examples

```bash
# Full environment + project audit
deploid doctor

# CI-friendly project validation
deploid doctor --project-only --json

# Brief local report
deploid doctor --summary

# Paste into an issue or pull request
deploid doctor --markdown

# Apply safe fixes like missing assets dir / capacitor config
deploid doctor --fix
```

### `deploid init`

Initialize Deploid in the current project.

```bash
deploid init [options]
```

Options:

<<<<<<< Updated upstream
| Option | Default | Description |
| --- | --- | --- |
| `-f, --framework <framework>` | `vite` | `vite`, `next`, `cra`, `static` |
| `-p, --packaging <engine>` | `capacitor` | `capacitor` only in 2.0 |
| `--all-plugins` | `false` | Install all available plugins |
| `--debug` | `false` | Enable debug logging |
=======
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-f, --framework <framework>` | `string` | `vite` | Web framework (vite\|next\|cra\|static) |
| `-p, --packaging <engine>` | `string` | `capacitor` | Android packaging engine (`capacitor` only in 2.0) |
| `--app-name <name>` | `string` | prompt/default | App display name |
| `--app-id <id>` | `string` | prompt/default | App/package ID (reverse-domain) |
| `--description <text>` | `string` | prompt/default | Project description |
| `--author-name <name>` | `string` | prompt/default | Author name |
| `--author-email <email>` | `string` | prompt/default | Author email |
| `--assets-source <path>` | `string` | prompt/default | Asset source path stored in config |
| `--force` | `boolean` | `false` | Recreate `deploid.config.ts` if it already exists |

#### Examples

```bash
# Initialize with defaults (Vite + Capacitor)
deploid init

# Initialize for Next.js with Capacitor
deploid init --framework next --packaging capacitor

# Fully non-interactive metadata setup
deploid init --app-name "NineGrid" --app-id "dev.madsens.ninegrid" --author-name "Chris Madsen" --author-email "chris@madsens.dev" --description "NineGrid Sudoku app" --assets-source "public/logo.png"

# Deploid 2.0 supports capacitor packaging only
deploid init --framework vite --packaging capacitor
```

#### Generated Files

- `deploid.config.ts` - Configuration file
- `assets/` - Directory for your logo
- `assets-gen/` - Generated assets output
- `capacitor.config.json` - Capacitor configuration (if using Capacitor)
>>>>>>> Stashed changes

### `deploid release init`

Scaffold Android signing, versioning, env templates, and publish placeholders for release workflows.

```bash
deploid release init [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-y, --yes` | `boolean` | `false` | Apply recommended defaults without prompts |
| `--keystore-path <path>` | `string` | `secrets/android-upload-keystore.jks` | Path to the Android release keystore |
| `--alias <name>` | `string` | app-name-derived | Keystore alias |
| `--store-password-env <name>` | `string` | `DEPLOID_ANDROID_STORE_PASSWORD` | Env var name for keystore password |
| `--key-password-env <name>` | `string` | `DEPLOID_ANDROID_KEY_PASSWORD` | Env var name for key password |
| `--github-repo <owner/repo>` | `string` | inferred / `owner/repo` | GitHub repository used for publishing |
| `--play-track <track>` | `string` | `internal` | Play Console track (`internal`, `alpha`, `beta`, `production`) |
| `--play-service-account <path>` | `string` | `secrets/play-service-account.json` | Path to the Play service account JSON |
| `--build-type <type>` | `string` | `aab` | Preferred release artifact (`apk`, `aab`, `both`) |
| `--debug` | `boolean` | `false` | Enable debug logging |

#### What It Creates

- Adds `android.signing`, `android.version`, `android.build`, and `publish` placeholders to `deploid.config.*`
- Creates or updates `.env.deploid.example`
- Creates the `secrets/` folder for release credentials
- Appends release-sensitive paths to `.gitignore`

#### Examples

```bash
# Scaffold release defaults
deploid release init --yes

# Override repo and artifact defaults
deploid release init --github-repo acme/ninegrid --build-type both

# Customize keystore paths and env var names
deploid release init --keystore-path release/upload.jks --store-password-env ANDROID_STORE_PASSWORD --key-password-env ANDROID_KEY_PASSWORD
```

### `deploid version`

Sync semver, Android versionCode/name, and release notes scaffolding.

```bash
deploid version [options] [version]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `[version]` | `string` | semver bump | Explicit semver version, e.g. `2.0.0` |
| `--major` | `boolean` | `false` | Bump the major version |
| `--minor` | `boolean` | `false` | Bump the minor version |
| `--patch` | `boolean` | `false` | Bump the patch version |
| `--code <number>` | `number` | auto-increment | Explicit Android `versionCode` |
| `--no-sync-package` | `boolean` | `false` | Leave `package.json` version unchanged |
| `--notes-file <path>` | `string` | `RELEASE_NOTES.md` | Release notes scaffold file |
| `--dry-run` | `boolean` | `false` | Print the resolved version plan without writing files |
| `--json` | `boolean` | `false` | Emit the dry-run plan as JSON |
| `--debug` | `boolean` | `false` | Enable debug logging |

#### What It Updates

- `android.version.name`
- `android.version.code`
- `package.json` version (unless `--no-sync-package`)
- `RELEASE_NOTES.md` (or your chosen notes file)

#### Examples

```bash
# Default patch bump
deploid version --patch

# Minor bump and inspect the plan only
deploid version --minor --dry-run --json

# Set an explicit release version and versionCode
deploid version 2.0.0 --code 10
```

### `deploid changelog`

Create or update `CHANGELOG.md` entries from release notes and optional git history.

```bash
deploid changelog [options] [version]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `[version]` | `string` | config/package version | Explicit version to write |
| `--notes-file <path>` | `string` | `RELEASE_NOTES.md` | Source release notes file |
| `--changelog-file <path>` | `string` | `CHANGELOG.md` | Target changelog file |
| `--from-git` | `boolean` | `false` | Include commit subjects since the latest git tag |
| `--dry-run` | `boolean` | `false` | Print the resolved changelog plan without writing files |
| `--json` | `boolean` | `false` | Emit the dry-run plan as JSON |
| `--debug` | `boolean` | `false` | Enable debug logging |

#### What It Updates

- Creates `CHANGELOG.md` if missing
- Prepends a versioned changelog entry using `RELEASE_NOTES.md`
- Optionally adds a `Commits` section from git history

#### Examples

```bash
# Create a changelog entry from current release notes
deploid changelog

# Include commit subjects since the latest tag
deploid changelog --from-git

# Preview the generated entry
deploid changelog --dry-run --json
```

### `deploid ship`

Run the end-to-end Android release workflow in one command.

```bash
deploid ship [options] [version]
```

#### What It Orchestrates

- `deploid doctor --summary`
- `deploid assets`
- `deploid package`
- optional `deploid version`
- `deploid build`
- `deploid changelog`
- `deploid publish`

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `[version]` | `string` | - | Explicit version to pass to `deploid version` |
| `--major` | `boolean` | `false` | Bump major version before build |
| `--minor` | `boolean` | `false` | Bump minor version before build |
| `--patch` | `boolean` | `false` | Bump patch version before build |
| `--code <number>` | `number` | - | Explicit Android `versionCode` |
| `--notes-file <path>` | `string` | `RELEASE_NOTES.md` | Release notes file used by version/changelog/publish |
| `--changelog-file <path>` | `string` | `CHANGELOG.md` | Changelog target file |
| `--from-git` | `boolean` | `false` | Include git commit subjects in changelog generation |
| `--target <target>` | `string` | `all` | Publish target (`github`, `play`, `all`) |
| `--artifact <path>` | `string` | auto-detected | Explicit artifact path for publish |
| `--release-name <name>` | `string` | generated | GitHub release title override |
| `--tag <tag>` | `string` | generated | GitHub release tag override |
| `--draft` | `boolean` | `false` unless passed | Keep GitHub release as draft |
| `--latest` | `boolean` | `false` unless passed | Mark GitHub release as latest |
| `--no-doctor` | `boolean` | `false` | Skip readiness checks |
| `--no-assets` | `boolean` | `false` | Skip asset generation |
| `--no-package` | `boolean` | `false` | Skip Android packaging |
| `--no-build` | `boolean` | `false` | Skip Android build |
| `--no-changelog` | `boolean` | `false` | Skip changelog generation |
| `--no-publish` | `boolean` | `false` | Skip artifact publishing |
| `--dry-run` | `boolean` | `false` | Print the ordered workflow plan without executing |
| `--debug` | `boolean` | `false` | Enable debug logging |

#### Examples

```bash
# Preview the full release workflow
deploid ship --patch --from-git --dry-run

# Build a release without publishing
deploid ship --patch --from-git --no-publish

# Ship only to GitHub with an explicit version
deploid ship 2.1.0 --target github --from-git
```

### `deploid artifacts list`

List generated Android, desktop, and asset outputs known to Deploid.

```bash
deploid artifacts list [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--kind <kind>` | `string` | `all` | Artifact kind (`all`, `android-debug-apk`, `android-release-apk`, `android-release-aab`, `assets`, `desktop`) |
| `--json` | `boolean` | `false` | Emit machine-readable JSON |
| `--debug` | `boolean` | `false` | Enable debug logging |

### `deploid artifacts inspect`

Show detailed metadata for generated outputs that currently exist.

```bash
deploid artifacts inspect [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--kind <kind>` | `string` | `all` | Artifact kind filter |
| `--json` | `boolean` | `false` | Emit machine-readable JSON |
| `--debug` | `boolean` | `false` | Enable debug logging |

### `deploid artifacts clean`

Remove generated outputs.

```bash
deploid artifacts clean [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--kind <kind>` | `string` | `all` | Artifact kind filter |
| `--dry-run` | `boolean` | `false` | Preview cleanup targets without deleting files |
| `--json` | `boolean` | `false` | Emit machine-readable JSON |
| `--debug` | `boolean` | `false` | Enable debug logging |

#### Examples

```bash
# List all known outputs
deploid artifacts list

# Inspect only Android release bundles
deploid artifacts inspect --kind android-release-aab

# Preview desktop cleanup
deploid artifacts clean --kind desktop --dry-run

# Flag aliases on the parent command
deploid artifacts --list
deploid artifacts --inspect --kind android-release-aab
deploid artifacts --clean --kind desktop --dry-run
```

### `deploid plugin init`

Scaffold a new standalone Deploid plugin package.

```bash
deploid plugin init <name> [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--dir <path>` | `string` | `plugins/<name>` | Target directory for the scaffold |
| `--force` | `boolean` | `false` | Overwrite an existing target directory |

#### Generated Files

- `package.json`
- `tsconfig.json`
- `src/index.ts`
- `README.md`

#### Examples

```bash
deploid plugin init hello-world
deploid plugin init storage-sync --dir tooling/storage-sync
```

### `deploid plugin validate`

Validate a Deploid plugin package scaffold.

```bash
deploid plugin validate [path] [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--json` | `boolean` | `false` | Emit machine-readable validation output |

#### Examples

```bash
deploid plugin validate .
deploid plugin validate ./plugins/hello-world --json
```

### `deploid daemon`

Run a local HTTP daemon for dashboards, editor integrations, and other external clients.

```bash
deploid daemon [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--host <host>` | `string` | `127.0.0.1` | Host interface to bind |
| `--port <number>` | `number` | `4949` | Port to bind |
| `--token <token>` | `string` | none | Optional bearer token required for requests |
| `--debug` | `boolean` | `false` | Enable debug logging |

#### Endpoints

- `GET /health`
- `GET /config?cwd=/abs/path`
- `GET /artifacts?cwd=/abs/path&kind=all`
- `GET /devices`
- `POST /doctor`
- `POST /plugin`

#### Examples

```bash
deploid daemon
deploid daemon --port 5050 --token local-dev-token
```

### `deploid ci init github`

Generate GitHub Actions workflow scaffolding for Deploid release pipelines.

```bash
deploid ci init github [options]
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--workflow-name <name>` | `string` | `Deploid Release` | Workflow name shown in GitHub Actions |
| `--node-version <version>` | `string` | `20` | Node.js version used in CI |
| `--java-version <version>` | `string` | `21` | Java version used for Android builds |
| `--package-manager <name>` | `string` | `auto` | Package manager override (`auto`, `npm`, `pnpm`, `yarn`, `bun`) |
| `--no-include-version` | `boolean` | `false` | Skip `deploid version --patch` in the generated workflow |
| `--force` | `boolean` | `false` | Overwrite existing generated CI files |
| `--debug` | `boolean` | `false` | Enable debug logging |

#### Generated Files

- `.github/workflows/deploid-release.yml`
- `.github/DEPLOID_SECRETS.md`

#### What It Includes

- Checkout, Node, Java, and Android SDK setup
- Package-manager-aware dependency installation
- `deploid doctor`, `assets`, `package`, `build`, and `publish`
- Optional `deploid version --patch`
- A secrets/setup guide for GitHub repository configuration

#### Examples

```bash
# Generate a default GitHub Actions release workflow
deploid ci init github

# Customize workflow name and toolchain versions
deploid ci init github --workflow-name "Android Release" --node-version 22 --java-version 21

# Regenerate workflow files
deploid ci init github --force
```

### `deploid assets`

Generate Android/PWA assets from your configured logo.

```bash
<<<<<<< Updated upstream
deploid assets [--debug]
```

=======
deploid assets [options]
```

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `--source <path>` | `string` | Override `assets.source` for this run (e.g. `public/logo.png`) |

#### Generated Assets

**Android Icons**:
- `assets-gen/android/mipmap-mdpi/ic_launcher.png` (48x48)
- `assets-gen/android/mipmap-hdpi/ic_launcher.png` (72x72)
- `assets-gen/android/mipmap-xhdpi/ic_launcher.png` (96x96)
- `assets-gen/android/mipmap-xxhdpi/ic_launcher.png` (144x144)
- `assets-gen/android/mipmap-xxxhdpi/ic_launcher.png` (192x192)

**PWA Icons**:
- `assets-gen/icon-192.png` (192x192)
- `assets-gen/icon-512.png` (512x512)
- `assets-gen/apple-touch-icon.png` (180x180)

**Favicons**:
- `assets-gen/favicon-16x16.png` (16x16)
- `assets-gen/favicon-32x32.png` (32x32)
- `assets-gen/favicon-48x48.png` (48x48)
- `assets-gen/favicon-64x64.png` (64x64)

#### Requirements

- Source logo at `assets/logo.svg` (or path specified in config)
- Logo should be at least 512x512 pixels for best results

#### Examples

```bash
# Use source from config
deploid assets

# Override source without editing config
deploid assets --source public/logo.png
```

>>>>>>> Stashed changes
### `deploid package`

Run Capacitor packaging flow.

```bash
deploid package [--debug]
```

Notes:
- `android.packaging` must be `capacitor` in 2.0.
- Uses your configured `web.buildCommand`.

### `deploid electron`

Setup Electron desktop packaging for Windows, macOS, and Linux.

```bash
deploid electron
```

#### What It Does

- Creates `electron/main.cjs` and `electron/preload.cjs` if missing
- Adds Electron scripts to `package.json`
- Adds `electron-builder` config with Win/macOS/Linux targets
- Installs `electron` and `electron-builder` as dev dependencies

#### Output

- Desktop artifacts are generated into `dist-electron/` when you run:
  - `npm run electron:build:win`
  - `npm run electron:build:mac`
  - `npm run electron:build:linux`

### `deploid build`

Build Android artifacts.

```bash
deploid build [--debug]
```

Output:
- Debug APK always.
- Release AAB when signing config is present.

### `deploid deploy`

Deploy debug APK to connected devices.

```bash
deploid deploy [--debug] [-f|--force] [-l|--launch]
```

<<<<<<< Updated upstream
## Device Commands
=======
#### Options

| Option | Type | Description |
|--------|------|-------------|
| `-f, --force` | `boolean` | Force install (overwrite existing app) |
| `-l, --launch` | `boolean` | Launch app after installation |
| `-d, --device <id>` | `string` | Deploy to one specific device/emulator |
| `--boot-emulator <avd>` | `string` | Boot an emulator before deploying |
| `--logs` | `boolean` | Tail app logs after launching |
| `--log-filter <tag>` | `string` | Explicit logcat tag/filter to use with `--logs` |

#### Requirements

- Android device connected via USB with USB debugging enabled
- ADB (Android Debug Bridge) installed
- APK must be built (run `deploid build` first)

#### Examples

```bash
# Deploy to all connected devices
deploid deploy

# Force install and launch app
deploid deploy --force --launch

# Deploy to one USB device only
deploid deploy --device pixel-usb --launch

# Boot an emulator, install, launch, and stream logs
deploid deploy --boot-emulator Pixel_8_API_35 --launch --logs
```
>>>>>>> Stashed changes

### `deploid devices`

List connected Android devices.

```bash
deploid devices [options]
```

<<<<<<< Updated upstream
=======
#### Options

| Option | Type | Description |
|--------|------|-------------|
| `--json` | `boolean` | Output machine-readable device list |
| `--boot <avd>` | `string` | Launch an emulator before listing devices |

#### Output

Shows all connected Android devices with their device IDs and connection status.

>>>>>>> Stashed changes
### `deploid logs`

Stream Android logs.

```bash
deploid logs [options]
```

<<<<<<< Updated upstream
=======
#### Options

| Option | Type | Description |
|--------|------|-------------|
| `-d, --device <id>` | `string` | Read logs from a specific device/emulator |
| `--app-only` | `boolean` | Filter logcat output to the current app |
| `--filter <tag>` | `string` | Explicit logcat tag/filter override |

#### Requirements

- Android device connected
- App must be installed on device

>>>>>>> Stashed changes
### `deploid uninstall`

Uninstall app from connected device(s).

```bash
deploid uninstall
```

## Utility Commands

### `deploid debug`

Add network debugging component and troubleshooting guide.

```bash
deploid debug
```

### `deploid plugin`

Manage plugins.

```bash
deploid plugin --list
deploid plugin --install <plugin>
deploid plugin --remove <plugin>
```

### `deploid firebase`

Run Firebase setup helper.

```bash
deploid firebase [--project-id <id>] [--auto-create]
```

## iOS Commands

### `deploid ios`

Prepare iOS project handoff artifacts.

```bash
deploid ios
```

### `deploid ios:handbook`

Generate iOS handoff documentation.

```bash
deploid ios:handbook
```

### `deploid ios:assets`

```bash
deploid ios:assets
```

Status: not implemented in 2.0 (fails fast).

## Publish Command

### `deploid publish`

```bash
deploid publish [options]
```

<<<<<<< Updated upstream
Status: not implemented in 2.0 (fails fast).
=======
#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--target <target>` | `string` | `all` | Publish target (`github`, `play`, `all`) |
| `--artifact <path>` | `string` | auto-detected | Explicit APK/AAB path override |
| `--notes <text>` | `string` | generated | Inline release notes |
| `--notes-file <path>` | `string` | - | Load release notes from a file |
| `--tag <tag>` | `string` | `v<android.version.name>` | GitHub release tag |
| `--release-name <name>` | `string` | `<appName> <version>` | GitHub release title |
| `--draft` | `boolean` | config/default | Keep the GitHub release as draft |
| `--latest` | `boolean` | `false` unless passed | Mark the GitHub release as latest |
| `--dry-run` | `boolean` | `false` | Print the resolved publish plan without calling external APIs |
| `--debug` | `boolean` | `false` | Enable debug logging |

#### Supported Targets

**Play Store**:
- Internal testing track
- Alpha testing track
- Beta testing track
- Production track

**GitHub Releases**:
- Draft releases
- Published releases
- Generated or file-based release notes

#### Requirements

**Play Store**:
- Google service account JSON file
- App must be created in Play Console
- Release track must be configured
- A release APK or AAB must already exist

**GitHub Releases**:
- `publish.github.repo` must be configured
- `GITHUB_TOKEN` or `GH_TOKEN`
- A release APK or AAB must already exist

#### Examples

```bash
# Inspect what would be published
deploid publish --dry-run

# Publish only to GitHub with explicit notes
deploid publish --target github --notes "Release 1.2.3"

# Publish only to Play using a specific artifact
deploid publish --target play --artifact android/app/build/outputs/bundle/release/app-release.aab
```
>>>>>>> Stashed changes

## Environment Variables

### Logging

```bash
export DEPLOID_LOG_LEVEL=debug
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Build and Publish
on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Deploid
        run: npm install -g @deploid/cli
      
      - name: Generate Assets
        run: deploid assets
      
      - name: Package for Android
        run: deploid package
      
      - name: Build APK/AAB
        run: deploid build
        env:
          ANDROID_STORE_PWD: ${{ secrets.ANDROID_STORE_PWD }}
          ANDROID_KEY_PWD: ${{ secrets.ANDROID_KEY_PWD }}
      
      - name: Publish to GitHub
        run: deploid publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Local Development

```bash
export ANDROID_STORE_PWD="..."
export ANDROID_KEY_PWD="..."
```
