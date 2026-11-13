# Release checklist

Use this checklist for a GB-Quest browser/itch.io release. It supplements `docs/ITCH_IO_RELEASE.md`; it does not publish anything automatically.

## 1. Source and dependency baseline

- [ ] Confirm the intended branch and commit.
- [ ] Confirm the working tree contains no accidental generated files, credentials, local saves, or database dumps.
- [ ] Use the Node.js version supported by `package.json`.
- [ ] Install from the lockfile with `npm ci`.

## 2. Automated checks

Run from the repository root:

```sh
npm run check:syntax
npm test
```

If the change touches native rules, run the documented native build/tests. If it changes PostgreSQL schema or MMO behavior, run migrations against a disposable test database and execute the database-backed integration suite. Record commands and outcomes; do not infer success from source inspection.

## 3. Browser package

```sh
npm run build:itch
```

Expected artifact:

```
build/gbquest-itch-html5.zip
```

Verify that the ZIP is readable and contains exactly one root-level `index.html` (no enclosing folder). Confirm that the HTML file is non-empty and contains the built game rather than a development placeholder.

## 4. Manual smoke test

- [ ] Open the built HTML locally in a supported browser.
- [ ] Confirm the boot/logo and loading sequence completes.
- [ ] Start a new game and reach the playable world.
- [ ] Test keyboard controls and on-screen touch controls.
- [ ] Test a save and reload.
- [ ] Test one combat encounter and one menu flow.
- [ ] Test atlas/map navigation and fullscreen.
- [ ] Check browser console for uncaught errors and failed asset requests.
- [ ] Check a narrow mobile viewport and a desktop viewport.

## 5. itch.io upload

1. Open the project's itch.io edit page.
2. Upload `build/gbquest-itch-html5.zip` as an HTML project file.
3. Enable **This file will be played in the browser**.
4. Use the documented 960 × 864 embed viewport unless the release notes specify otherwise.
5. Save, then test the published embed on desktop and mobile.

## 6. Optional Butler publishing

The optional GitHub Actions publishing workflow requires:

- `BUTLER_API_KEY` as an encrypted Actions secret.
- `ITCH_USERNAME` and `ITCH_GAME` as Actions variables.

Never commit these values or inject them into the browser bundle. Confirm the target project and channel before manually starting a publish workflow.

## 7. Release record

Record:

- Version and build identifier.
- Git commit SHA and branch/tag.
- CI run URL and test/build outcomes.
- ZIP filename and byte size.
- Manual smoke-test date and browser/device coverage.
- itch.io project URL and channel, if published.
- Known issues and rollback artifact.

A successful ZIP build is not proof that the live itch.io upload works; record those as separate checks.
