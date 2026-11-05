# Browser entry point and viewport

GB-Quest is an HTML5/JavaScript Canvas 2D game. It does not ship as a Java JAR, so there is no Java main class to enter in a JAR Class Name field. The machine-readable project metadata is in `game-metadata.json`.

## Entry points

- Development: `index.html`
- Bundled desktop browser layout: `dist/gbquest.html`
- Full-window browser layout: `dist/gbquest-fullscreen.html`

Build the distributable browser files with:

```sh
node tools/build.cjs
```

## Viewport

The logical game viewport is **160 × 144 pixels** (10:9). The fullscreen browser build scales the canvas to fit the available browser viewport without stretching the image. It uses the available width and height, preserves the 160:144 aspect ratio, and centers the canvas. On supported screens it prefers integer pixel scaling to retain crisp pixel art.

The full-window build removes the handheld device frame and fills the browser's content viewport. The **FULL SCREEN** control and **F** key request the browser Fullscreen API. Browsers require this request to originate from a user gesture; a web page cannot force native fullscreen automatically on initial load. Browser chrome may remain visible until the user enters fullscreen using the in-game control or browser controls.

## Platform metadata

Use `game-metadata.json` for HTML5 packaging or hosting integrations. Set a Java JAR class name only if the game is ported to Java and a real Java entry class is added. Do not enter a made-up class name for this browser build.
