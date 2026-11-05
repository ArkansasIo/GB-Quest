package io.arkansasio.gbquest;

import javax.swing.*;
import java.awt.*;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Native Java desktop entry point for GB-Quest. */
public final class Main {
    private Main() {}
    public static void main(String[] args) {
        if (args.length>0 && "--browser".equals(args[0])) { launchBrowser(args); return; }
        if (GraphicsEnvironment.isHeadless()) {
            System.err.println("GB-Quest Java Edition requires a graphical desktop session.");
            System.exit(2);
        }
        SwingUtilities.invokeLater(() -> {
            GameState state=new GameState();
            try { SaveStore.load(state); } catch(IOException ex) { System.err.println("Save load failed: "+ex.getMessage()); }
            JFrame frame=new JFrame("Lost Kingdom of Shadowbane Chronicles — Java Edition");
            frame.setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
            GamePanel panel=new GamePanel(state);
            frame.add(panel);frame.pack();frame.setLocationRelativeTo(null);frame.setResizable(false);
            frame.addWindowListener(new WindowAdapter(){@Override public void windowClosing(WindowEvent e){
                try { SaveStore.save(state); } catch(IOException ex){System.err.println("Save failed: "+ex.getMessage());}
                frame.dispose();System.exit(0);
            }});
            frame.setVisible(true);panel.requestFocusInWindow();
        });
    }
    private static void launchBrowser(String[] args) {
        Path gameFile=args.length>1?Path.of(args[1]).toAbsolutePath().normalize():
                Path.of("dist","gbquest-fullscreen.html").toAbsolutePath().normalize();
        if(!Files.isRegularFile(gameFile)){System.err.println("Browser build not found: "+gameFile);System.exit(2);}
        try {
            var uri=gameFile.toUri();
            if(!Desktop.isDesktopSupported()||!Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)){System.out.println(uri);return;}
            Desktop.getDesktop().browse(uri);
        } catch(IOException ex){System.err.println("Could not open browser: "+ex.getMessage());System.exit(2);}
    }
}
