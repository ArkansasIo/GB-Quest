# Contributing to Lost Kingdom of Shadowbane Chronicles

1. **Read** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/UML.md](docs/UML.md) first.
2. **Keep the runtime dependency-free.** The game is plain JavaScript in one global scope. `tools/build.cjs` is the canonical ordered bundler; `tools/build.py` is a compatibility wrapper. Do not add frameworks or bundlers to the runtime.
3. **Keep it deterministic.** Generated content must use `RNG(seedString)`, never `Math.random()`, so every player sees the same world. Effects-only randomness (particles, stereo spread) is fine.
4. **Keep it original.** Use no names, text, maps, art or audio from other games or books. Rules may model the SRD 5.1 (CC-BY-4.0).
5. **Respect the screen.** All gameplay UI must fit 160×144 and work with the d-pad plus A and B.
6. **Before a PR**, run:
   ```sh
   python3 tools/build.py && node tools/gen_docs.cjs && npm test
   ```
   Then open `dist/gbquest.html` and `dist/gbquest-fullscreen.html` and check for console errors.
7. **Code style:** 2-space indent, single quotes, `const` by default, short functions, a comment heading per section (`// ====` / `// ----`).
8. **Commits:** imperative subject ("Add sea lanes to world map"), with a body that explains why.
