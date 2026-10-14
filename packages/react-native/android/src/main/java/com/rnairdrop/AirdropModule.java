package com.rnairdrop;

import android.content.Context;
import android.content.Intent;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AirdropModule extends ReactContextBaseJavaModule {
  public static final String NAME = "RNAirdrop";
  private static final ExecutorService executor = Executors.newSingleThreadExecutor();

  public AirdropModule(ReactApplicationContext context) {
    super(context);
  }

  @NonNull
  @Override
  public String getName() {
    return NAME;
  }

  @Override
  public Map<String, Object> getConstants() {
    Context ctx = getReactApplicationContext();
    Map<String, Object> c = new HashMap<>();
    c.put("platform", "android");
    c.put("sdkVersion", Airdrop.SDK_VERSION);
    c.put("enabled", Airdrop.isEnabled(ctx));
    c.put("runtimeVersion", Airdrop.getRuntimeVersion(ctx));
    c.put("serverUrl", Airdrop.getStringResource(ctx, "airdrop_server_url"));
    c.put("appId", Airdrop.getStringResource(ctx, "airdrop_app_id"));
    String channel = Airdrop.getStringResource(ctx, "airdrop_channel");
    c.put("channel", channel != null ? channel : "production");
    return c;
  }

  private UpdateManager manager() {
    return Airdrop.getUpdateManager(getReactApplicationContext());
  }

  @ReactMethod
  public void getState(Promise promise) {
    try {
      UpdateManager m = manager();
      WritableMap map = Arguments.createMap();
      map.putString("deviceId", m.getDeviceId());
      map.putString("currentUpdateId", m.getLaunchedUpdateId());
      map.putString("pendingUpdateId", m.getPendingUpdateId());
      map.putBoolean("rollbackToEmbeddedPending", m.isRollbackToEmbeddedPending());
      map.putArray("failedUpdateIds", toArray(m.getFailedUpdateIds()));
      promise.resolve(map);
    } catch (Throwable t) {
      promise.reject("ERR_STATE", t.getMessage(), t);
    }
  }

  @ReactMethod
  public void downloadUpdate(ReadableMap manifest, Promise promise) {
    final UpdateManager.Update update;
    try {
      update = parseManifest(manifest);
    } catch (Throwable t) {
      promise.reject("ERR_INVALID_MANIFEST", t.getMessage(), t);
      return;
    }
    executor.execute(
        () -> {
          try {
            manager().download(update, null);
            promise.resolve(update.id);
          } catch (UpdateManager.UpdateException e) {
            promise.reject(e.code, e.getMessage(), e);
          } catch (Throwable t) {
            promise.reject("ERR_DOWNLOAD", t.getMessage(), t);
          }
        });
  }

  /** Confirms the running update booted fine. Resolves {installedUpdateId, rolledBackUpdateIds}. */
  @ReactMethod
  public void notifyAppReady(Promise promise) {
    try {
      UpdateManager m = manager();
      WritableMap map = Arguments.createMap();
      map.putString("installedUpdateId", m.markLaunchSuccessful());
      map.putArray("rolledBackUpdateIds", toArray(m.takeUnreportedRollbacks()));
      promise.resolve(map);
    } catch (Throwable t) {
      promise.reject("ERR_STATE", t.getMessage(), t);
    }
  }

  @ReactMethod
  public void clearUpdates(Promise promise) {
    try {
      manager().clearToEmbedded();
      promise.resolve(null);
    } catch (Throwable t) {
      promise.reject("ERR_STATE", t.getMessage(), t);
    }
  }

  /**
   * Restarts the app so the pending bundle is loaded. The ReactHost bundle
   * loader is fixed at creation time, so a cold process restart is the only
   * approach that works across every RN version and architecture.
   */
  @ReactMethod
  public void restartApp() {
    Context ctx = getReactApplicationContext();
    Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
    if (launch == null) return;
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
    AirdropRestartActivity.restart(ctx, launch);
  }

  private static WritableArray toArray(List<String> list) {
    WritableArray arr = Arguments.createArray();
    for (String s : list) arr.pushString(s);
    return arr;
  }

  private static UpdateManager.FileEntry parseFile(ReadableMap m) {
    return new UpdateManager.FileEntry(
        m.getString("path"), m.getString("hash"), (long) m.getDouble("size"), m.getString("url"));
  }

  static UpdateManager.Update parseManifest(ReadableMap m) {
    UpdateManager.Update u = new UpdateManager.Update();
    u.id = m.getString("id");
    u.runtimeVersion = m.getString("runtimeVersion");
    u.platform = m.getString("platform");
    u.signature = m.hasKey("signature") && !m.isNull("signature") ? m.getString("signature") : null;
    u.launchAsset = parseFile(m.getMap("launchAsset"));
    ReadableArray assets = m.getArray("assets");
    if (assets != null) for (int i = 0; i < assets.size(); i++) u.assets.add(parseFile(assets.getMap(i)));
    return u;
  }
}
