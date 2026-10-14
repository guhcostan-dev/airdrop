package com.rnairdrop;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import java.io.File;

/**
 * Entry point used from MainApplication:
 *
 * <pre>
 *   getDefaultReactHost(
 *     context = applicationContext,
 *     packageList = PackageList(this).packages,
 *     jsBundleFilePath = Airdrop.getJSBundleFile(applicationContext),
 *   )
 * </pre>
 *
 * or, with a ReactNativeHost: {@code override fun getJSBundleFile() = Airdrop.getJSBundleFile(applicationContext)}.
 */
public final class Airdrop {
  static final String TAG = "Airdrop";
  public static final String SDK_VERSION = "0.1.0";
  static final String LAUNCH_FILE = "index.android.bundle";

  private static UpdateManager instance;

  private Airdrop() {}

  /**
   * Path of the OTA bundle to boot, or null to use the embedded bundle (always
   * null in debuggable builds, which load from Metro, unless
   * {@code airdrop_enable_in_debug} is "true").
   */
  public static String getJSBundleFile(Context context) {
    try {
      if (!isEnabled(context)) return null;
      String path = getUpdateManager(context).resolveBundlePath();
      if (path != null) Log.i(TAG, "Launching OTA bundle " + path);
      return path;
    } catch (Throwable t) {
      // Never let the updater prevent the app from booting.
      Log.e(TAG, "Failed to resolve bundle, using embedded one", t);
      return null;
    }
  }

  static boolean isEnabled(Context context) {
    boolean debuggable = (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    return !debuggable || "true".equals(getStringResource(context, "airdrop_enable_in_debug"));
  }

  static synchronized UpdateManager getUpdateManager(Context context) {
    if (instance == null) {
      Context app = context.getApplicationContext() != null ? context.getApplicationContext() : context;
      instance =
          new UpdateManager(
              new File(app.getFilesDir(), "airdrop"),
              getBinaryVersion(app),
              LAUNCH_FILE,
              getStringResource(app, "airdrop_public_key"));
    }
    return instance;
  }

  static String getStringResource(Context context, String name) {
    int id = context.getResources().getIdentifier(name, "string", context.getPackageName());
    if (id == 0) return null;
    String value = context.getString(id).trim();
    return value.isEmpty() ? null : value;
  }

  static PackageInfo getPackageInfo(Context context) {
    try {
      return context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
    } catch (PackageManager.NameNotFoundException e) {
      throw new IllegalStateException(e);
    }
  }

  /** Embedded runtime version: explicit resource, else versionName. Must match the CLI. */
  static String getRuntimeVersion(Context context) {
    String explicit = getStringResource(context, "airdrop_runtime_version");
    if (explicit != null) return explicit;
    String versionName = getPackageInfo(context).versionName;
    return versionName != null ? versionName : "1.0";
  }

  /** Changes on every store install/update, which resets downloaded OTA updates. */
  @SuppressWarnings("deprecation")
  static String getBinaryVersion(Context context) {
    PackageInfo info = getPackageInfo(context);
    long code = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    return info.versionName + "(" + code + ")@" + info.lastUpdateTime;
  }
}
