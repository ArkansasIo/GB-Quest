# GB-Quest — Claude Code project instructions

## Project identity

This repository contains **Lost Kingdom of Shadowbane Chronicles**, a browser-based, 160×144 Game Boy-style MMORPG/RPG implemented primarily with JavaScript and web assets. It also contains a Node/Electron desktop wrapper, backend services, generated distribution files, and native experiments. Read `README.md` and the relevant documentation before making changes.

## Non-negotiable safeguards

- Preserve the existing browser game as the current production baseline.
- Do not assume this repository is a Godot project.
- Summer Engine is a separate, Godot-4-compatible engine workflow. MCP setup connects Claude Code to a local Summer Engine installation; it does not convert this repository.
- Do not replace the current runtime, build pipeline, `src/`, `dist/`, Electron app, or backend as part of a Summer integration without explicit approval.
- Do not commit credentials, API keys, account tokens, local MCP configuration, or machine-specific paths.
- Avoid broad generated rewrites. Make small, reviewable changes and run relevant tests.

## Summer Engine workflow

See [docs/SUMMER_ENGINE_SETUP.md](docs/SUMMER_ENGINE_SETUP.md). If Summer MCP tools are available, use them for a separately scoped prototype only after inspecting the current project and explaining the proposed boundary. Keep the prototype in a clearly named directory such as `summer-prototype/`; do not mix Godot/Summer files into the existing browser runtime without a deliberate architecture decision.

Before implementing a prototype:
1. Inspect the existing data/content structures and asset licensing/provenance.
2. Propose a folder structure and data-sharing strategy.
3. Identify what can be reused directly and what requires conversion.
4. Get approval before a large migration or destructive change.

## Validation

Use the repository's documented commands and the narrowest relevant tests. The package scripts currently include `npm test`, `npm run sweep`, and native build commands; consult `package.json` and project docs for exact prerequisites. Report commands actually run and their results. Do not claim a build or game test passed unless it was executed.
