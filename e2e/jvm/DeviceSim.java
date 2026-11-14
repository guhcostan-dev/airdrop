import com.rnairdrop.UpdateManager;
import java.io.File;
import java.nio.file.Files;
import java.util.List;

/**
 * Drives the real Android UpdateManager against a live server, from the JVM.
 *
 * Each invocation is one app process:
 *   launch          boot, but die before notifyAppReady() (simulates a crash)
 *   launch-ready    boot and confirm (notifyAppReady)
 *   download <manifest.txt>
 *
 * manifest.txt: id, runtimeVersion, platform, signature|- then "path hash size url" lines.
 */
public class DeviceSim {
  public static void main(String[] args) throws Exception {
    String pub = args[2].equals("-") ? null : args[2];
    UpdateManager m = new UpdateManager(new File(args[0]), args[1], "index.android.bundle", pub);
    switch (args[3]) {
      case "launch":
      case "launch-ready": {
        String path = m.resolveBundlePath();
        System.out.println("launched=" + (path == null ? "embedded" : path));
        System.out.println("deviceId=" + m.getDeviceId());
        if (args[3].equals("launch-ready")) {
          System.out.println("installed=" + m.markLaunchSuccessful());
          System.out.println("rollbacks=" + String.join(",", m.takeUnreportedRollbacks()));
        }
        System.out.println("failed=" + String.join(",", m.getFailedUpdateIds()));
        break;
      }
      case "download": {
        List<String> lines = Files.readAllLines(new File(args[4]).toPath());
        UpdateManager.Update u = new UpdateManager.Update();
        u.id = lines.get(0);
        u.runtimeVersion = lines.get(1);
        u.platform = lines.get(2);
        u.signature = lines.get(3).equals("-") ? null : lines.get(3);
        for (int i = 4; i < lines.size(); i++) {
          String[] p = lines.get(i).split(" ");
          UpdateManager.FileEntry f = new UpdateManager.FileEntry(p[0], p[1], Long.parseLong(p[2]), p[3]);
          if (i == 4) u.launchAsset = f;
          else u.assets.add(f);
        }
        try {
          m.download(u, null);
          System.out.println("downloaded=" + u.id);
        } catch (UpdateManager.UpdateException e) {
          System.out.println("error=" + e.code + " " + e.getMessage());
          System.exit(3);
        }
        break;
      }
      default:
        throw new IllegalArgumentException(args[3]);
    }
  }
}
