# Browser entry point and viewport

GB-Quest is an HTML5/JavaScript Canvas 2D game. An optional Java 17 launcher JAR is now provided; it opens the generated HTML game in the system browser rather than reimplementing the game in Java. The machine-readable project metadata is in `game-metadata.json`.

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

## Optional Java JAR launcher

The real JAR entry-point class is `io.arkansasio.gbquest.Main`. It is implemented in `java-launcher/src/main/java/io/arkansasio/gbquest/Main.java` and configured in the Maven JAR manifest. Build it after generating the browser game:

```sh
node tools/build.cjs
cd java-launcher
mvn clean package
```

Run the resulting JAR from the repository root:

```sh
java -jar java-launcher/target/gbquest-browser-launcher-0.3.0.jar
```

This JAR is a browser launcher, not a native Java game port. The original HTML5 build remains the game runtime.
