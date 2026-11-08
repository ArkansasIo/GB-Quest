# Summer Engine + Claude Code setup

This repository is currently a browser-based Game Boy-style RPG, not a Godot/Summer Engine project. Summer Engine is compatible with Godot 4 projects, but connecting it does not automatically convert the existing JavaScript game.

## Recommended integration

Keep the current browser game as the production baseline. Use Summer Engine for a separate, optional Godot-compatible 3D/2D companion prototype or for experiments that can later be ported deliberately. Do not replace `src/`, `dist/`, the existing build pipeline, or the browser runtime without an explicit migration plan and review.

## Local setup

Requirements: Node.js 22 or newer, Git, Claude Code, and a Windows/macOS computer that can run the Summer Engine desktop app.

1. Clone this repository and open a terminal in its root:
   ```powershell
   git clone https://github.com/ArkansasIo/GB-Quest.git
   cd GB-Quest
   ```
2. Install the Summer Engine desktop app:
   ```powershell
   npx -y summer-engine@latest install
   ```
3. Sign in if you want Summer account/cloud features:
   ```powershell
   npx -y summer-engine@latest login
   ```
4. Register the local Summer MCP server and install its Claude Code skills:
   ```powershell
   npx -y summer-engine@latest setup claude-code --yes
   ```
   In Windows PowerShell, use `npx.cmd` instead of `npx` if command resolution requires it.
5. Restart Claude Code, open this repository, and run `/mcp` to verify the Summer tools are available.

The setup command configures the local Claude Code environment. It must be run on the developer's computer; a GitHub commit cannot install the desktop app or configure a local MCP server remotely.

## First task for Claude Code

Ask Claude Code:

> Read `CLAUDE.md`, `README.md`, and `docs/SUMMER_ENGINE_SETUP.md`. Inspect the existing game architecture. Verify that the Summer MCP tools are connected. Do not modify or migrate the existing browser game. Propose a separate Summer Engine prototype that reuses the game's original lore, item data, and visual direction where practical. Report the proposed folder structure and any compatibility risks before creating files.

## Important boundaries

- Preserve the existing JavaScript/browser game and its tests.
- Treat any Summer Engine project as a separate project until an explicit migration decision is made.
- Do not copy secrets, account tokens, local MCP configuration, or generated credentials into Git.
- Review all generated changes and run the existing test/build checks before merging.
- Engine export still depends on the target platform's required templates and toolchains.
