package com.rnairdrop;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.GZIPOutputStream;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

public class UpdateManagerTest {
  private static final String BUNDLE = "index.android.bundle";
  private HttpServer server;
  private final Map<String, byte[]> files = new HashMap<>();
  private final AtomicInteger requests = new AtomicInteger();
  private File dir;
  private String base;

  @Before
  public void setUp() throws Exception {
    dir = Files.createTempDirectory("airdrop").toFile();
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/",
        ex -> {
          requests.incrementAndGet();
          byte[] body = files.get(ex.getRequestURI().getPath().substring(1));
          if (body == null) {
            ex.sendResponseHeaders(404, -1);
            ex.close();
            return;
          }
          // Serve gzip like the Worker does; HttpURLConnection must decode it.
          ByteArrayOutputStream gz = new ByteArrayOutputStream();
          try (GZIPOutputStream z = new GZIPOutputStream(gz)) {
            z.write(body);
          }
          ex.getResponseHeaders().add("Content-Encoding", "gzip");
          ex.sendResponseHeaders(200, gz.size());
          try (OutputStream os = ex.getResponseBody()) {
            os.write(gz.toByteArray());
          }
        });
    server.start();
    base = "http://127.0.0.1:" + server.getAddress().getPort() + "/";
  }

  @After
  public void tearDown() {
    server.stop(0);
    UpdateManager.deleteRecursively(dir);
  }

  private static String sha256(byte[] data) throws Exception {
    StringBuilder sb = new StringBuilder();
    for (byte b : MessageDigest.getInstance("SHA-256").digest(data)) sb.append(String.format("%02x", b));
    return sb.toString();
  }

  private UpdateManager.FileEntry serve(String path, String content) throws Exception {
    byte[] data = content.getBytes(StandardCharsets.UTF_8);
    String hash = sha256(data);
    files.put(hash, data);
    return new UpdateManager.FileEntry(path, hash, data.length, base + hash);
  }

  private UpdateManager.Update update(String js, String... assets) throws Exception {
    UpdateManager.Update u = new UpdateManager.Update();
    u.id = UUID.randomUUID().toString();
    u.runtimeVersion = "1.0";
    u.platform = "android";
    u.launchAsset = serve(BUNDLE, js);
    for (String a : assets) u.assets.add(serve("drawable-mdpi/" + a + ".png", a));
    return u;
  }

  private UpdateManager manager(String binary) {
    return manager(binary, null);
  }

  private UpdateManager manager(String binary, String publicKey) {
    UpdateManager m = new UpdateManager(dir, binary, BUNDLE, publicKey);
    return m;
  }

  private String read(String path) throws Exception {
    return new String(Files.readAllBytes(new File(path).toPath()), StandardCharsets.UTF_8);
  }

  @Test
  public void installsOnNextLaunchAndConfirms() throws Exception {
    UpdateManager m = manager("1");
    assertNull(m.resolveBundlePath());
    UpdateManager.Update u = update("v1", "logo");
    m.download(u, null);
    assertEquals(u.id, m.getPendingUpdateId());

    UpdateManager next = manager("1"); // simulate process restart
    String path = next.resolveBundlePath();
    assertEquals("v1", read(path));
    assertTrue(new File(new File(path).getParentFile(), "drawable-mdpi/logo.png").isFile());
    assertEquals(u.id, next.getLaunchedUpdateId());
    assertEquals(u.id, next.markLaunchSuccessful());
    assertNull(next.markLaunchSuccessful());

    UpdateManager third = manager("1");
    assertEquals("v1", read(third.resolveBundlePath()));
    assertNull(third.markLaunchSuccessful());
  }

  @Test
  public void rollsBackWhenLaunchIsNeverConfirmed() throws Exception {
    UpdateManager m = manager("1");
    m.resolveBundlePath();
    UpdateManager.Update good = update("good");
    m.download(good, null);
    UpdateManager l2 = manager("1");
    l2.resolveBundlePath();
    l2.markLaunchSuccessful();

    UpdateManager.Update bad = update("crashes");
    l2.download(bad, null);
    UpdateManager l3 = manager("1");
    assertEquals("crashes", read(l3.resolveBundlePath()));
    // ...process dies before notifyAppReady()

    UpdateManager l4 = manager("1");
    assertEquals("good", read(l4.resolveBundlePath()));
    assertTrue(l4.getFailedUpdateIds().contains(bad.id));
    assertEquals(1, l4.takeUnreportedRollbacks().size());
    assertEquals(0, l4.takeUnreportedRollbacks().size());
    try {
      l4.download(bad, null);
      fail("failed updates must not be reinstalled");
    } catch (UpdateManager.UpdateException e) {
      assertEquals("ERR_UPDATE_FAILED_BEFORE", e.code);
    }
  }

  @Test
  public void resolveIsIdempotentWithinAProcess() throws Exception {
    UpdateManager m = manager("1");
    m.download(update("v1"), null);
    UpdateManager l2 = manager("1");
    String a = l2.resolveBundlePath();
    assertEquals(a, l2.resolveBundlePath()); // e.g. a JS reload must not count as a crash
  }

  @Test
  public void reloadInSameProcessPicksUpNewlyStagedUpdate() throws Exception {
    UpdateManager m = manager("1");
    assertNull(m.resolveBundlePath());
    UpdateManager.Update u = update("immediate");
    m.download(u, null);
    // iOS "immediate" install: JS reload asks for the bundle URL again in the same process.
    assertEquals("immediate", read(m.resolveBundlePath()));
    assertEquals(u.id, m.getLaunchedUpdateId());
    assertEquals(u.id, m.markLaunchSuccessful());
    // And a server rollback applies in-process too.
    m.clearToEmbedded();
    assertNull(m.resolveBundlePath());
  }

  @Test
  public void newBinaryResetsUpdates() throws Exception {
    UpdateManager m = manager("1");
    m.download(update("v1"), null);
    String device = m.getDeviceId();
    UpdateManager l2 = manager("2");
    assertNull(l2.resolveBundlePath());
    assertEquals(device, l2.getDeviceId());
  }

  @Test
  public void reusesUnchangedFiles() throws Exception {
    UpdateManager m = manager("1");
    m.download(update("v1", "a", "b"), null);
    UpdateManager l2 = manager("1");
    l2.resolveBundlePath();
    l2.markLaunchSuccessful();
    requests.set(0);
    l2.download(update("v2", "a", "b"), null);
    assertEquals("only the changed bundle is downloaded", 1, requests.get());
  }

  @Test
  public void rejectsTamperedContent() throws Exception {
    UpdateManager m = manager("1");
    UpdateManager.Update u = update("legit");
    files.put(u.launchAsset.hash, "evil".getBytes(StandardCharsets.UTF_8));
    try {
      m.download(u, null);
      fail();
    } catch (UpdateManager.UpdateException e) {
      assertEquals("ERR_HASH_MISMATCH", e.code);
    }
    assertNull(m.getPendingUpdateId());
  }

  @Test
  public void rejectsPathTraversal() throws Exception {
    UpdateManager m = manager("1");
    UpdateManager.Update u = update("x");
    u.assets.add(serve("../../evil", "boom"));
    try {
      m.download(u, null);
      fail();
    } catch (UpdateManager.UpdateException e) {
      assertEquals("ERR_INVALID_MANIFEST", e.code);
    }
  }

  @Test
  public void enforcesSignaturesWhenKeyIsEmbedded() throws Exception {
    KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
    gen.initialize(new ECGenParameterSpec("secp256r1"));
    KeyPair kp = gen.generateKeyPair();
    String pub = rawPoint((ECPublicKey) kp.getPublic());

    UpdateManager m = manager("1", pub);
    UpdateManager.Update unsigned = update("u", "a");
    try {
      m.download(unsigned, null);
      fail();
    } catch (UpdateManager.UpdateException e) {
      assertEquals("ERR_SIGNATURE", e.code);
    }

    UpdateManager.Update signed = update("s", "a", "b");
    Signature s = Signature.getInstance("SHA256withECDSA");
    s.initSign(kp.getPrivate());
    s.update(UpdateManager.signingMessage(signed).getBytes(StandardCharsets.UTF_8));
    signed.signature = Base64.getEncoder().encodeToString(s.sign());
    m.download(signed, null);
    assertNotNull(m.getPendingUpdateId());

    // Same signature, different content => rejected.
    UpdateManager.Update forged = update("forged", "a", "b");
    forged.signature = signed.signature;
    try {
      m.download(forged, null);
      fail();
    } catch (UpdateManager.UpdateException e) {
      assertEquals("ERR_SIGNATURE", e.code);
    }
  }

  @Test
  public void signingMessageMatchesTheCoreFormat() {
    UpdateManager.Update u = new UpdateManager.Update();
    u.runtimeVersion = "1.0.0";
    u.platform = "ios";
    String a = new String(new char[64]).replace('\0', 'a');
    String b = new String(new char[64]).replace('\0', 'b');
    u.launchAsset = new UpdateManager.FileEntry("main.jsbundle", a, 1, "x");
    u.assets.add(new UpdateManager.FileEntry("b.png", b, 1, "x"));
    u.assets.add(new UpdateManager.FileEntry("a.png", a, 1, "x"));
    assertEquals(
        "airdrop-v1\n1.0.0\nios\nmain.jsbundle:" + a + "\na.png:" + a + "\nb.png:" + b,
        UpdateManager.signingMessage(u));
  }

  @Test
  public void clearToEmbeddedAppliesOnNextLaunch() throws Exception {
    UpdateManager m = manager("1");
    m.download(update("v1"), null);
    UpdateManager l2 = manager("1");
    assertNotNull(l2.resolveBundlePath());
    l2.markLaunchSuccessful();
    l2.clearToEmbedded();
    assertTrue(l2.isRollbackToEmbeddedPending());
    assertNull(manager("1").resolveBundlePath());
    assertFalse(manager("1").isRollbackToEmbeddedPending());
  }

  private static String rawPoint(ECPublicKey key) {
    byte[] out = new byte[65];
    out[0] = 4;
    copyUnsigned(key.getW().getAffineX().toByteArray(), out, 1);
    copyUnsigned(key.getW().getAffineY().toByteArray(), out, 33);
    return Base64.getEncoder().encodeToString(out);
  }

  private static void copyUnsigned(byte[] src, byte[] dst, int offset) {
    int start = src.length > 32 ? src.length - 32 : 0;
    int len = src.length - start;
    System.arraycopy(src, start, dst, offset + 32 - len, len);
  }
}
