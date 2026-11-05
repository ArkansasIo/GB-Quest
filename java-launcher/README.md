# GB-Quest Java JAR launcher

GB-Quest itself is an HTML5/JavaScript game. This optional Java 17 launcher supplies a real JAR entry point and opens the generated full-window HTML build in the user's default browser. It does not reimplement the game in Java or embed a browser engine.

## JAR main class

```text
io.arkansasio.gbquest.Main
```

## Build

From the repository root:

```sh
node tools/build.cjs
cd java-launcher
mvn clean package
```

The executable JAR is:

```text
java-launcher/target/gbquest-browser-launcher-0.3.0.jar
```

Run it from the repository root so it can find the generated browser build:

```sh
java -jar java-launcher/target/gbquest-browser-launcher-0.3.0.jar
```

You can optionally pass an explicit HTML build path:

```sh
java -jar java-launcher/target/gbquest-browser-launcher-0.3.0.jar dist/gbquest.html
```

Requires Java 17 or newer and a graphical desktop session with a registered browser. If desktop browsing is unavailable, the launcher prints the local file URL. Generate the HTML build first with `node tools/build.cjs`.
