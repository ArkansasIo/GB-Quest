# Build, test and release

## Requirements

- Python 3.10+ with Pillow and NumPy (asset tools)
- Node 18+ (atlas export, doc generation, tests)
- Optional: Playwright with Chromium (headless screenshots), CMake and a C++23 compiler with SDL2 (desktop port)

## Build everything

```sh
python3 tools/build.py          # runs build_atlas.py first, then:
                                #   index.html                    dev build (serve the folder over http)
                                #   dist/gbquest.html             single file, handheld frame
                                #   dist/gbquest-fullscreen.html  single file, full-screen window
                                #   dist/atlas.html               interactive atlas
node tools/gen_docs.cjs          # docs/STORY, CHARACTERS, CONTENT_CATALOG, WORLD_ATLAS
python3 tools/gen_hd64.py       # assets_hd64/ (64-bit atlases)
```

Regenerate the art only when the source sheets change:

```sh
python3 tools/extract_assets.py && python3 tools/gen_assets.py
python3 tools/gen_gbtiles.py
python3 tools/make_worldmap.py && python3 tools/slice_sheets.py
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
npm test                        # node --test: data integrity, rules, generators
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
3. Headless screenshots of the title, field, battle, map, atlas, 64-bit mode and full screen; no page errors
4. Update `CHANGELOG.md` and the version in `BUILD` (`src/data_world.js`) and in the shell's build strip
5. Commit, then `git push`; CI runs the tests and the desktop build
