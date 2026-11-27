package com.rnairdrop;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Process;

/**
 * Runs in a separate process (see AndroidManifest): kills the app process,
 * relaunches it and exits. Same technique as ProcessPhoenix.
 */
public class AirdropRestartActivity extends Activity {
  private static final String KEY_INTENT = "airdrop_restart_intent";
  private static final String KEY_PID = "airdrop_main_pid";

  static void restart(Context context, Intent launch) {
    Intent intent = new Intent(context, AirdropRestartActivity.class);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    intent.putExtra(KEY_INTENT, launch);
    intent.putExtra(KEY_PID, Process.myPid());
    context.startActivity(intent);
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    Process.killProcess(getIntent().getIntExtra(KEY_PID, -1));
    Intent launch = getIntent().getParcelableExtra(KEY_INTENT);
    if (launch != null) startActivity(launch);
    finish();
    Runtime.getRuntime().exit(0);
  }
}
