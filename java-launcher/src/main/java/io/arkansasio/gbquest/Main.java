package io.arkansasio.gbquest;

import java.awt.Desktop;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Optional Java JAR launcher for the HTML5 GB-Quest browser build.
 * The game itself remains HTML5/JavaScript; this class opens its full-window
 * build in the system browser.
 */
public final class Main {
    private Main() {}

    public static void main(String[] args) throws IOException {
        Path gameFile = args.length > 0
                ? Path.of(args[0]).toAbsolutePath().normalize()
                : Path.of("dist", "gbquest-fullscreen.html").toAbsolutePath().normalize();

        if (!Files.isRegularFile(gameFile)) {
            System.err.println("GB-Quest browser build was not found: " + gameFile);
            System.err.println("Run 'node tools/build.cjs' from the repository root first,");
            System.err.println("or pass the path to an existing HTML game build.");
            System.exit(2);
        }

        var gameUri = gameFile.toUri();
        if (!Desktop.isDesktopSupported()
                || !Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
            System.out.println("Open this GB-Quest game URL in a browser:");
            System.out.println(gameUri);
            return;
        }

        Desktop.getDesktop().browse(gameUri);
        System.out.println("Opened GB-Quest in the default browser: " + gameUri);
    }
}
