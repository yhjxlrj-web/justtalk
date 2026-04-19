package com.justtalk.app;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "JT-REALTIME";

    static {
        Log.e(TAG, "[JT-REALTIME] main activity class loaded");
    }

    private void logNative(String message) {
        Log.e(TAG, message);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        logNative("[JT-REALTIME] activity onCreate reached");
        logNative("[JT-REALTIME] bridge alive");
        super.onCreate(savedInstanceState);
        logNative("[JT-REALTIME] activity onCreate complete");
    }

    @Override
    public void onStart() {
        super.onStart();
        logNative("[JT-REALTIME] activity onStart");
    }

    @Override
    public void onResume() {
        super.onResume();
        logNative("[JT-REALTIME] activity onResume");
    }
}
