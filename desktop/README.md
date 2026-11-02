# Windows and macOS desktop app

The installable desktop app wraps the complete bundled browser game in Electron. It opens the **Shadowbane Chronicles Launcher** first, then starts the local game after a realm destination is selected. The independent C++/SDL2 files in this folder are still a prototype and do not contain the full game yet.

## Requirements

- Node.js 22 or newer
- npm
- Windows to build Windows installers; macOS to build macOS installers

## Run locally

From the repository root:

```sh
npm install
node tools/build.cjs
npm run desktop:dev
```

The app opens `desktop/launcher.html` in a resizable desktop window. The launcher provides North America, Europe, Japan and Oceania region selection, logical data-center and world selection, a Play action, update checking, and project/documentation links. The selected destination is passed to the game as URL query parameters (`region`, `dataCenter`, `world`).

The launcher also supports account registration and login against the existing realm API (`POST /api/register`, `POST /api/login`), plus connectivity checks using `GET /api/health` and `GET /api/realms`. Enter a realm base URL in the launcher; HTTPS is required for remote hosts, while HTTP is permitted only for localhost development. Passwords are sent directly from the launcher to the selected server over that connection and are not saved by the desktop client. Session tokens are kept in memory and encrypted with Electron `safeStorage` when the OS key store is available; otherwise the session lasts only until the app closes. The launcher can list the account's three cloud-save slots through authenticated `GET /api/saves`, showing each saved character's name, level, and class. The selected slot is passed to the game as the `characterSlot` query parameter. The desktop game retrieves its launch context through a restricted preload bridge. The Electron main process retains the session credential and proxies authenticated realm API requests and the SSE event stream; the credential is not copied into game local storage. When a cloud slot is selected, the game downloads that slot into its local save store before startup and automatically enters the selected character. If no slot is selected, the normal title screen appears. The bridge currently supports the existing shared realm API; it does not route logical data-center/world labels to separate servers. The current backend has a shared realm service, not 11 separately deployed data centers or 85 independently routed worlds. Live world population and region-aware world routing remain future integration work. Keyboard, mouse, saved settings, and the game's display modes work inside the app.

## Package installers

Build on the target operating system:

```sh
# Windows: NSIS installer and portable .exe
npm run desktop:dist -- --win

# macOS: Intel and Apple Silicon DMG and ZIP packages
npm run desktop:dist -- --mac
```

Artifacts are written to `release/`. The **Desktop packages** workflow builds both operating systems; start it from GitHub Actions or push a `desktop-v*` tag, then download the Windows and macOS workflow artifacts.

Packages are unsigned unless signing credentials are configured. Windows may display a SmartScreen prompt. macOS users may need to approve the app in Privacy & Security or open it from Finder's context menu. Signing and notarization require developer certificates that are not included in this repository.

## Game updates

In the desktop app, choose **Help > Check for Game Updates**. The updater checks the latest published release in `ArkansasIo/GB-Quest`, downloads the self-contained game bundle and its SHA-256 manifest over HTTPS, verifies the bundle, then stages it in the app's user-data folder. Restart to apply it. Game saves and settings remain in the desktop profile and are mirrored when switching the bundled game file.

To publish an update, push a `desktop-vX.Y.Z` tag matching `package.json`'s version. The Desktop packages workflow builds both operating-system installers and publishes them alongside the game bundle and update manifest. Manual workflow runs continue to produce downloadable workflow artifacts without publishing a release.

## Window controls

- Use **View > Toggle Full Screen** in the native app menu or choose a display mode in the game's Settings.
- On macOS, the app uses the standard menu-bar and window-close behavior.
- App data such as saves and key bindings remains in the Electron application's local storage.

## Graphics API

Choose **Graphics API** from the native menu. Automatic is the recommended default. Windows also offers DirectX 11, DirectX 11 on DirectX 12, Vulkan and OpenGL; macOS offers Metal and OpenGL. Changing the backend saves the choice and restarts the app. The DirectX 12 option uses ANGLE's D3D11-on-12 translation route; it is not a native Direct3D 12 game renderer.

These options select Chromium/ANGLE's GPU backend where the installed driver and Electron build support it. The game itself currently draws 2D scenes with Canvas 2D. PBR, ray/path tracing, global illumination, Nanite-style geometry, SSAO, DLSS/FSR, HDR and volumetric rendering require a separate 3D renderer and suitable 3D assets; choosing a graphics API does not enable those effects.
