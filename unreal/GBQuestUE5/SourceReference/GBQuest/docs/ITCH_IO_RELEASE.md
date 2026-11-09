# itch.io HTML5 release

GB-Quest is published to itch.io as an HTML5 browser game. Upload the ZIP produced by the release build; do not upload the Java JAR for the browser game.

## Build

Requirements: Node.js 20+ and Python 3.

From the repository root:

```sh
npm run build:itch
```

The command rebuilds the browser edition, copies the full-window single-file game to `build/itch/index.html`, and creates:

```
build/gbquest-itch-html5.zip
└── index.html
```

The ZIP is intentionally flat: `index.html` is at the archive root, and the game source and image atlases are embedded in the HTML. Do not zip the containing `build/itch` folder itself or create an extra top-level directory inside the archive.

## Upload to itch.io

1. Create or open the GB-Quest project on itch.io.
2. Set **Kind of project** to **HTML**.
3. Upload `build/gbquest-itch-html5.zip` as a new file.
4. Mark the uploaded file as **This file will be played in the browser**.
5. Set the embed viewport to **960 × 864** (10:9 aspect ratio). If the page layout needs a smaller embed, use **640 × 576**.
6. Enable **Automatically start on page load** only if the game’s opening screen is suitable for immediate play. Otherwise leave it disabled so the player can start from the page.
7. Save the project and test the embedded game on desktop and mobile.

The game uses the browser's fullscreen API, which requires a player gesture. The in-game **FULL SCREEN** control remains available when browser fullscreen is supported. Keyboard and on-screen touch controls are included.

## Release validation

The build script verifies that the canvas and embedded asset catalog are present, checks that no loose source or asset paths remain, creates the ZIP, and confirms that the archive contains only a root-level `index.html`.

GitHub Actions also builds and uploads the ZIP as the `gbquest-itch-html5` workflow artifact. Download that artifact and upload the ZIP file to itch.io.

## Important

The build produces a ready-to-upload ZIP; it does not publish to your itch.io account. Publishing requires signing in to itch.io and uploading the artifact, or configuring an authenticated Butler upload separately.


## Automated publishing with Butler

The repository includes a manual/release-triggered GitHub Actions workflow at
`.github/workflows/itchio-publish.yml`. To enable it:

1. In the GitHub repository, open **Settings → Secrets and variables → Actions**.
2. Add the repository secret `BUTLER_API_KEY` using an itch.io API key from your itch.io account settings.
3. Add repository variables `ITCH_USERNAME` and `ITCH_GAME` with the itch.io account name and project URL slug (not the full URL).
4. Open **Actions → Publish itch.io HTML5**, choose **Run workflow**, and keep the channel set to `html5`.

The workflow rebuilds and validates the single-file HTML5 ZIP, installs the official Butler CLI, and pushes the generated build to the configured project/channel. Publishing on a GitHub Release also triggers the workflow and uses the `html5` channel. Never commit the API key or place it in repository variables; keep it in the encrypted Actions secret.
