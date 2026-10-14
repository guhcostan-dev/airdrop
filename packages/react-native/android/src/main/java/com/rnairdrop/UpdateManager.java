package com.rnairdrop;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;

/**
 * Platform-independent update logic (plain Java, no Android APIs) so it can be
 * unit-tested on the JVM. Owns the on-disk layout:
 *
 * <pre>
 *   baseDir/state.properties        launch state (see fields below)
 *   baseDir/updates/&lt;id&gt;/           one directory per installed update
 *   baseDir/updates/&lt;id&gt;/airdrop-manifest.txt   "path\thash" lines, used to reuse files
 * </pre>
 *
 * Launch protocol (crash-safe rollback):
 *  1. download() stages an update and records it as {@code pending}.
 *  2. On the next launch resolveBundlePath() marks it {@code pendingLaunched} and returns it.
 *  3. JS calls notifyAppReady() once the app rendered -> markLaunchSuccessful() promotes it to current.
 *  4. If the process dies before step 3, the next launch sees pendingLaunched=true, marks the
 *     update as failed (never installed again) and boots the previous bundle instead.
 */
public class UpdateManager {
  public static final String EMBEDDED = "embedded";
  private static final String MANIFEST_FILE = "airdrop-manifest.txt";
  /** DER prefix turning a raw uncompressed P-256 point into a SubjectPublicKeyInfo. */
  private static final byte[] P256_SPKI_PREFIX = hexToBytes("3059301306072a8648ce3d020106082a8648ce3d030107034200");

  public static class FileEntry {
    public final String path;
    public final String hash;
    public final long size;
    public final String url;

    public FileEntry(String path, String hash, long size, String url) {
      this.path = path;
      this.hash = hash;
      this.size = size;
      this.url = url;
    }
  }

  public static class Update {
    public String id;
    public String runtimeVersion;
    public String platform;
    public String signature;
    public FileEntry launchAsset;
    public List<FileEntry> assets = new ArrayList<>();
  }

  public interface ProgressListener {
    void onProgress(long receivedBytes, long totalBytes);
  }

  public static class UpdateException extends Exception {
    public final String code;

    public UpdateException(String code, String message) {
      super(message);
      this.code = code;
    }

    public UpdateException(String code, String message, Throwable cause) {
      super(message, cause);
      this.code = code;
    }
  }

  private final File baseDir;
  private final File updatesDir;
  private final File stateFile;
  private final String binaryVersion;
  private final String launchFileName;
  private final String publicKey;
  private final Properties state = new Properties();

  /** Update id whose bundle this process booted (null = embedded). */
  private String launchedUpdateId;
  private boolean resolved;
  private String launchedPath;

  public UpdateManager(File baseDir, String binaryVersion, String launchFileName, String publicKey) {
    this.baseDir = baseDir;
    this.updatesDir = new File(baseDir, "updates");
    this.stateFile = new File(baseDir, "state.properties");
    this.binaryVersion = binaryVersion;
    this.launchFileName = launchFileName;
    this.publicKey = publicKey == null || publicKey.trim().isEmpty() ? null : publicKey.trim();
    loadState();
    if (!binaryVersion.equals(state.getProperty("binaryVersion"))) {
      // Fresh install, or a new native build came from the store: its embedded
      // bundle supersedes anything downloaded for the previous binary.
      String deviceId = state.getProperty("deviceId");
      state.clear();
      if (deviceId != null) state.setProperty("deviceId", deviceId);
      state.setProperty("binaryVersion", binaryVersion);
      deleteRecursively(updatesDir);
      saveState();
    }
  }

  // ------------------------------------------------------------------ launch

  /**
   * Returns the absolute path of the JS bundle to boot, or null for the bundle
   * embedded in the binary. Idempotent within a process (RN may ask twice).
   */
  public synchronized String resolveBundlePath() {
    // Asked again in the same process (JS reload): keep the running bundle unless a
    // new update was staged since, which is how "immediate" installs apply in-process.
    if (resolved) {
      String pending = state.getProperty("pending");
      boolean freshPending =
          pending != null && !pending.equals(launchedUpdateId) && !"true".equals(state.getProperty("pendingLaunched"));
      if (!freshPending) return launchedPath;
    }
    resolved = true;

    String pending = state.getProperty("pending");
    if (pending != null) {
      if (EMBEDDED.equals(pending)) {
        state.remove("current");
        state.remove("pending");
        state.remove("pendingLaunched");
        saveState();
      } else if ("true".equals(state.getProperty("pendingLaunched"))) {
        rollBack(pending);
      } else if (bundleFile(pending).isFile()) {
        state.setProperty("pendingLaunched", "true");
        saveState();
        return launch(pending);
      } else {
        rollBack(pending);
      }
    }

    String current = state.getProperty("current");
    if (current != null) {
      if (bundleFile(current).isFile()) return launch(current);
      state.remove("current");
      saveState();
    }
    return launch(null);
  }

  private String launch(String updateId) {
    launchedUpdateId = updateId;
    launchedPath = updateId == null ? null : bundleFile(updateId).getAbsolutePath();
    return launchedPath;
  }

  private void rollBack(String updateId) {
    addToList("failed", updateId);
    addToList("unreportedRollbacks", updateId);
    state.remove("pending");
    state.remove("pendingLaunched");
    saveState();
    deleteRecursively(new File(updatesDir, updateId));
  }

  /**
   * Called from JS once the app has rendered. Returns the id of an update that
   * was just confirmed for the first time (to report an install), else null.
   */
  public synchronized String markLaunchSuccessful() {
    String pending = state.getProperty("pending");
    if (launchedUpdateId == null || !launchedUpdateId.equals(pending)) return null;
    if (!"true".equals(state.getProperty("pendingLaunched"))) return null;
    state.setProperty("current", pending);
    state.remove("pending");
    state.remove("pendingLaunched");
    saveState();
    garbageCollect();
    return pending;
  }

  /** Server asked to go back to the embedded bundle; applied on next launch. */
  public synchronized void clearToEmbedded() {
    if (state.getProperty("current") == null && state.getProperty("pending") == null) return;
    state.setProperty("pending", EMBEDDED);
    state.remove("pendingLaunched");
    saveState();
  }

  public synchronized List<String> takeUnreportedRollbacks() {
    List<String> out = getList("unreportedRollbacks");
    state.remove("unreportedRollbacks");
    saveState();
    return out;
  }

  // ------------------------------------------------------------------ queries

  public synchronized String getDeviceId() {
    String id = state.getProperty("deviceId");
    if (id == null) {
      id = UUID.randomUUID().toString();
      state.setProperty("deviceId", id);
      saveState();
    }
    return id;
  }

  public synchronized String getLaunchedUpdateId() {
    return launchedUpdateId;
  }

  public synchronized String getPendingUpdateId() {
    String p = state.getProperty("pending");
    // A pending update that is already running is not "waiting for restart".
    if (p == null || EMBEDDED.equals(p) || p.equals(launchedUpdateId)) return null;
    return p;
  }

  public synchronized boolean isRollbackToEmbeddedPending() {
    return EMBEDDED.equals(state.getProperty("pending"));
  }

  public synchronized List<String> getFailedUpdateIds() {
    return getList("failed");
  }

  public boolean isSigningRequired() {
    return publicKey != null;
  }

  // ------------------------------------------------------------------ download

  /** Downloads, verifies and stages an update. Blocking; call off the main thread. */
  public void download(Update update, ProgressListener progress) throws UpdateException {
    validate(update);
    synchronized (this) {
      if (getList("failed").contains(update.id))
        throw new UpdateException("ERR_UPDATE_FAILED_BEFORE", "update " + update.id + " previously failed to launch");
      if (update.id.equals(launchedUpdateId) || update.id.equals(state.getProperty("pending"))) return;
    }

    // Signing is opt-in: it is enforced only when the binary embeds a public key.
    if (publicKey != null) verifySignature(update);

    List<FileEntry> files = new ArrayList<>();
    files.add(update.launchAsset);
    files.addAll(update.assets);
    long total = 0;
    for (FileEntry f : files) total += f.size;

    Map<String, File> reusable = reusableFiles();
    File staging = new File(updatesDir, update.id + ".tmp");
    deleteRecursively(staging);
    if (!staging.mkdirs()) throw new UpdateException("ERR_IO", "cannot create " + staging);

    long received = 0;
    try {
      for (FileEntry f : files) {
        File target = safeChild(staging, f.path);
        File parent = target.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs())
          throw new UpdateException("ERR_IO", "cannot create " + parent);
        File existing = reusable.get(f.hash);
        if (existing != null && existing.isFile() && f.hash.equals(sha256(existing))) {
          copy(existing, target);
        } else {
          downloadFile(f, target);
        }
        received += f.size;
        if (progress != null) progress.onProgress(received, total);
      }
      writeManifest(staging, files);
      // The launch asset must be at the conventional name so RN resolves assets next to it.
      File finalDir = new File(updatesDir, update.id);
      deleteRecursively(finalDir);
      if (!staging.renameTo(finalDir)) throw new UpdateException("ERR_IO", "cannot move staged update");
    } catch (UpdateException e) {
      deleteRecursively(staging);
      throw e;
    } catch (IOException e) {
      deleteRecursively(staging);
      throw new UpdateException("ERR_DOWNLOAD", e.getMessage(), e);
    }

    synchronized (this) {
      String previousPending = state.getProperty("pending");
      state.setProperty("pending", update.id);
      state.remove("pendingLaunched");
      saveState();
      if (previousPending != null && !EMBEDDED.equals(previousPending) && !previousPending.equals(launchedUpdateId))
        deleteRecursively(new File(updatesDir, previousPending));
    }
  }

  private void validate(Update u) throws UpdateException {
    if (u == null || u.id == null || !u.id.matches("[0-9a-f-]{36}"))
      throw new UpdateException("ERR_INVALID_MANIFEST", "invalid update id");
    if (u.launchAsset == null) throw new UpdateException("ERR_INVALID_MANIFEST", "missing launch asset");
    if (!launchFileName.equals(u.launchAsset.path))
      throw new UpdateException(
          "ERR_INVALID_MANIFEST", "launch asset must be named " + launchFileName + " (got " + u.launchAsset.path + ")");
    List<FileEntry> all = new ArrayList<>(u.assets);
    all.add(u.launchAsset);
    for (FileEntry f : all) {
      if (f.hash == null || !f.hash.matches("[0-9a-f]{64}"))
        throw new UpdateException("ERR_INVALID_MANIFEST", "invalid hash for " + f.path);
      if (!isSafePath(f.path)) throw new UpdateException("ERR_INVALID_MANIFEST", "unsafe path " + f.path);
      if (f.url == null || !(f.url.startsWith("https://") || f.url.startsWith("http://")))
        throw new UpdateException("ERR_INVALID_MANIFEST", "invalid url for " + f.path);
    }
  }

  static boolean isSafePath(String path) {
    if (path == null || path.isEmpty() || path.startsWith("/") || path.contains("\\") || path.contains("\0"))
      return false;
    if (path.equals(MANIFEST_FILE)) return false;
    for (String seg : path.split("/", -1)) {
      if (seg.isEmpty() || seg.equals(".") || seg.equals("..")) return false;
    }
    return true;
  }

  private static File safeChild(File dir, String rel) throws UpdateException {
    try {
      File f = new File(dir, rel);
      String base = dir.getCanonicalPath() + File.separator;
      if (!f.getCanonicalPath().startsWith(base)) throw new UpdateException("ERR_INVALID_MANIFEST", "path escapes update dir");
      return f;
    } catch (IOException e) {
      throw new UpdateException("ERR_IO", e.getMessage(), e);
    }
  }

  /** Mirrors signingMessage() in packages/core/src/signing.ts. */
  public static String signingMessage(Update u) {
    List<String> assets = new ArrayList<>();
    for (FileEntry f : u.assets) assets.add(f.path + ":" + f.hash);
    Collections.sort(assets);
    StringBuilder sb = new StringBuilder();
    sb.append("airdrop-v1\n").append(u.runtimeVersion).append('\n').append(u.platform).append('\n');
    sb.append(u.launchAsset.path).append(':').append(u.launchAsset.hash);
    for (String a : assets) sb.append('\n').append(a);
    return sb.toString();
  }

  private void verifySignature(Update u) throws UpdateException {
    if (u.signature == null || u.signature.isEmpty())
      throw new UpdateException("ERR_SIGNATURE", "update is not signed but this binary requires signed updates");
    try {
      byte[] raw = decodeBase64(publicKey);
      if (raw.length != 65 || raw[0] != 4) throw new UpdateException("ERR_SIGNATURE", "invalid public key in binary");
      byte[] spki = Arrays.copyOf(P256_SPKI_PREFIX, P256_SPKI_PREFIX.length + raw.length);
      System.arraycopy(raw, 0, spki, P256_SPKI_PREFIX.length, raw.length);
      PublicKey key = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(spki));
      Signature verifier = Signature.getInstance("SHA256withECDSA");
      verifier.initVerify(key);
      verifier.update(signingMessage(u).getBytes(StandardCharsets.UTF_8));
      if (!verifier.verify(decodeBase64(u.signature)))
        throw new UpdateException("ERR_SIGNATURE", "signature verification failed");
    } catch (UpdateException e) {
      throw e;
    } catch (Exception e) {
      throw new UpdateException("ERR_SIGNATURE", "signature verification failed: " + e.getMessage(), e);
    }
  }

  private void downloadFile(FileEntry f, File target) throws IOException, UpdateException {
    IOException last = null;
    for (int attempt = 0; attempt < 3; attempt++) {
      HttpURLConnection conn = (HttpURLConnection) new URL(f.url).openConnection();
      conn.setConnectTimeout(15000);
      conn.setReadTimeout(30000);
      // Ask for gzip explicitly and decode it ourselves: Android only decodes
      // transparently when it set the header itself, other JVMs never do.
      conn.setRequestProperty("Accept-Encoding", "gzip");
      try {
        int code = conn.getResponseCode();
        if (code != 200) {
          last = new IOException("HTTP " + code + " for " + f.path);
          if (code >= 500) continue;
          throw last;
        }
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long written = 0;
        InputStream raw = conn.getInputStream();
        if ("gzip".equalsIgnoreCase(conn.getContentEncoding())) raw = new java.util.zip.GZIPInputStream(raw);
        try (InputStream in = raw; OutputStream out = new FileOutputStream(target)) {
          byte[] buf = new byte[64 * 1024];
          int n;
          while ((n = in.read(buf)) != -1) {
            written += n;
            if (written > f.size) throw new UpdateException("ERR_HASH_MISMATCH", f.path + " is larger than declared");
            digest.update(buf, 0, n);
            out.write(buf, 0, n);
          }
        }
        String actual = bytesToHex(digest.digest());
        if (!actual.equals(f.hash)) {
          target.delete();
          throw new UpdateException("ERR_HASH_MISMATCH", "hash mismatch for " + f.path);
        }
        return;
      } catch (java.security.NoSuchAlgorithmException e) {
        throw new IOException(e);
      } catch (IOException e) {
        last = e;
      } finally {
        conn.disconnect();
      }
    }
    throw last != null ? last : new IOException("download failed for " + f.path);
  }

  /** hash -> file from the updates already on disk, so unchanged files are copied, not downloaded. */
  private synchronized Map<String, File> reusableFiles() {
    Map<String, File> out = new HashMap<>();
    for (String id : new String[] {state.getProperty("current"), launchedUpdateId, state.getProperty("pending")}) {
      if (id == null || EMBEDDED.equals(id)) continue;
      File dir = new File(updatesDir, id);
      File manifest = new File(dir, MANIFEST_FILE);
      if (!manifest.isFile()) continue;
      try (BufferedReader r =
          new BufferedReader(new InputStreamReader(new FileInputStream(manifest), StandardCharsets.UTF_8))) {
        String line;
        while ((line = r.readLine()) != null) {
          int tab = line.indexOf('\t');
          if (tab > 0) out.put(line.substring(tab + 1), new File(dir, line.substring(0, tab)));
        }
      } catch (IOException ignored) {
      }
    }
    return out;
  }

  private static void writeManifest(File dir, List<FileEntry> files) throws IOException {
    try (Writer w = new OutputStreamWriter(new FileOutputStream(new File(dir, MANIFEST_FILE)), StandardCharsets.UTF_8)) {
      for (FileEntry f : files) w.write(f.path + "\t" + f.hash + "\n");
    }
  }

  private synchronized void garbageCollect() {
    File[] dirs = updatesDir.listFiles();
    if (dirs == null) return;
    String current = state.getProperty("current");
    String pending = state.getProperty("pending");
    for (File d : dirs) {
      String name = d.getName();
      if (name.equals(current) || name.equals(pending) || name.equals(launchedUpdateId)) continue;
      deleteRecursively(d);
    }
  }

  // ------------------------------------------------------------------ helpers

  private File bundleFile(String updateId) {
    return new File(new File(updatesDir, updateId), launchFileName);
  }

  private List<String> getList(String key) {
    String v = state.getProperty(key, "");
    List<String> out = new ArrayList<>();
    for (String s : v.split(",")) if (!s.isEmpty()) out.add(s);
    return out;
  }

  private void addToList(String key, String value) {
    LinkedHashSet<String> set = new LinkedHashSet<>(getList(key));
    set.add(value);
    List<String> list = new ArrayList<>(set);
    // Bound the list; very old failures are irrelevant once newer updates exist.
    if (list.size() > 50) list = list.subList(list.size() - 50, list.size());
    StringBuilder joined = new StringBuilder();
    for (String s : list) joined.append(joined.length() == 0 ? "" : ",").append(s);
    state.setProperty(key, joined.toString());
  }

  private void loadState() {
    if (!stateFile.isFile()) return;
    try (InputStream in = new FileInputStream(stateFile)) {
      state.load(in);
    } catch (IOException ignored) {
      state.clear();
    }
  }

  /** Atomic write: temp file + rename, so a crash never leaves a torn state file. */
  private void saveState() {
    try {
      if (!baseDir.isDirectory()) baseDir.mkdirs();
      File tmp = new File(baseDir, "state.properties.tmp");
      try (FileOutputStream out = new FileOutputStream(tmp)) {
        state.store(out, null);
        out.getFD().sync();
      }
      if (!tmp.renameTo(stateFile)) {
        stateFile.delete();
        tmp.renameTo(stateFile);
      }
    } catch (IOException ignored) {
    }
  }

  static String sha256(File file) {
    try (InputStream in = new FileInputStream(file)) {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] buf = new byte[64 * 1024];
      int n;
      while ((n = in.read(buf)) != -1) digest.update(buf, 0, n);
      return bytesToHex(digest.digest());
    } catch (Exception e) {
      return "";
    }
  }

  private static void copy(File from, File to) throws IOException {
    try (InputStream in = new FileInputStream(from); OutputStream out = new FileOutputStream(to)) {
      byte[] buf = new byte[64 * 1024];
      int n;
      while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
    }
  }

  static void deleteRecursively(File f) {
    if (f == null || !f.exists()) return;
    File[] children = f.listFiles();
    if (children != null) for (File c : children) deleteRecursively(c);
    f.delete();
  }

  private static String bytesToHex(byte[] bytes) {
    StringBuilder sb = new StringBuilder(bytes.length * 2);
    for (byte b : bytes) sb.append(String.format("%02x", b));
    return sb.toString();
  }

  /** java.util.Base64 needs API 26 and android.util.Base64 is not plain Java, so decode by hand. */
  static byte[] decodeBase64(String s) {
    String alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
    int buffer = 0;
    int bits = 0;
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      if (c == '=') break;
      if (c == '-') c = '+';
      if (c == '_') c = '/';
      int v = alphabet.indexOf(c);
      if (v < 0) {
        if (Character.isWhitespace(c)) continue;
        throw new IllegalArgumentException("invalid base64");
      }
      buffer = (buffer << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out.write((buffer >> bits) & 0xff);
      }
    }
    return out.toByteArray();
  }

  private static byte[] hexToBytes(String hex) {
    byte[] out = new byte[hex.length() / 2];
    for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    return out;
  }
}
