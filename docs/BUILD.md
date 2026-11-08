# Build, test and release

## Requirements

- Python 3.10+ with Pillow and NumPy (asset and atlas tools)
- Node.js 20+ (canonical runtime builder, atlas export, documentation and tests)
- Optional: Playwright with Chromium (headless screenshots), CMake and a C++23 compiler with SDL2 (desktop port)

## Build everything

```sh
python3 tools/build.py          # builds the live atlas, then delegates to tools/build.cjs
                                # index.html                    development build
                                # dist/gbquest.html             self-contained game
                                # dist/gbquest-fullscreen.html  self-contained full-screen game
                                # dist/atlas.html               interactive atlas
node tools/gen_docs.cjs         # regenerate generated reference documentation
```

`tools/build.cjs` is the single canonical runtime bundler. It embeds the current shell, classic handheld UI theme, player HUD styles, PNG game assets, HD64 atlas pages/indexes, Citadel SVG artwork, and the live world atlas. The Python command is retained as a compatibility wrapper so older scripts use the same release implementation.

Regenerate generated artwork only when the source artwork or generator definitions change:

```sh
python3 tools/gen_gbtiles.py
python3 tools/gen_newart.py
python3 tools/gen_hd64.py
node tools/build.cjs
```

## Run

| Build | How |
|---|---|
| Single file | open `dist/gbquest.html` or `dist/gbquest-fullscreen.html` in a browser |
| Dev | `python3 -m http.server` in the repo, then open `http://localhost:8000` |
| Atlas | open `dist/atlas.html` |
| Desktop port | `cmake -S desktop -B build && cmake --build build` (see `desktop/README.md`) |

## Full-screen window build

`dist/gbquest-fullscreen.html` is the same game with `client/fullscreen.html` layered over `client/shell.html`:

- The LCD fills the window with the aspect ratio locked. **1:1 PIXELS** switches to whole-number scaling.
- **FULL SCREEN** (or the F key) uses the browser's full-screen API where it is allowed.
- **PAD** shows or hides the touch d-pad and buttons. They are shown by default on touch devices and hidden on desktop.
- **CHAT** (or the C key) is an overlay chat panel. **ATLAS** (or the M key) opens the embedded atlas.

## Tests

```sh
npm test                        # node --test: data integrity, rules, generators and UI/build contracts
```

Headless smoke tests use the `window.GBQ` debug hooks, for example:

```js
GBQ.newGame({ name: 'TEST', cls: 'warden', species: 'hearthkin', bg: 'soldier' });
GBQ.enterWorld();
GBQ.startBattle(GBQ.rollEncounter(GBQ.ZONES.find(z => z.id === GBQ.G.map)));
GBQ.openAtlas();
```

## Release checklist

1. `python3 tools/build.py` and `node tools/gen_docs.cjs`
2. `npm test`
3. Run `npm run build:itch` and verify the ZIP contains one root-level `index.html`
4. Verify title, field, battle, map, atlas, HUD and full-screen layouts in a browser; check the console for asset-load errors
5. Update `CHANGELOG.md` and the version metadata when making a release
6. Commit and push; GitHub Actions runs the tests, asset pipeline and release packaging
