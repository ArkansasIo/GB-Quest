# Game client

This folder owns the browser-facing shell and boot entry point:

- `shell.html` — desktop/mobile layout, chat dock, and client host markup.
- `fullscreen.html` — full-window presentation layer composed into the release bundle.
- `main.js` — boot, input/chat wiring, autosave, and browser integration.

The game modules and runtime systems remain in `../src/` because they share a global script scope and are concatenated in a fixed order. `tools/build.cjs` and `tools/build.py` assemble those modules with this client shell into `index.html` and `dist/`. Keep network calls in `src/netlocal.js` and route them through the backend API; never put credentials or admin secrets in client code.
