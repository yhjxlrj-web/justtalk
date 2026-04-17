package com.justtalk.app;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

@CapacitorPlugin(name = "JTLogger")
public class JTLoggerPlugin extends Plugin {
    private static final String TAG = "JT-REALTIME";
    private static final int MAX_LOG_LENGTH = 3800;

    @PluginMethod
    public void log(PluginCall call) {
        try {
            String message = call.getString("message", "[JT-REALTIME] log");
            String payload = call.getString("payload");
            String level = call.getString("level", "info");
            String composedMessage = composeMessage(message, payload);

            String normalizedLevel = level == null
                ? "info"
                : level.toLowerCase(Locale.ROOT);

            Log.d(TAG, "[JT-REALTIME] plugin invoke start | level=" + normalizedLevel);

            switch (normalizedLevel) {
                case "error":
                    Log.e(TAG, composedMessage);
                    break;
                case "warn":
                    Log.w(TAG, composedMessage);
                    break;
                case "debug":
                    Log.d(TAG, composedMessage);
                    break;
                default:
                    Log.i(TAG, composedMessage);
                    break;
            }

            Log.d(TAG, "[JT-REALTIME] plugin invoke success");

            JSObject result = new JSObject();
            result.put("ok", true);
            call.resolve(result);
        } catch (Exception exception) {
            Log.e(TAG, "[JT-REALTIME] plugin invoke failed", exception);
            call.reject("JTLogger plugin failed", exception);
        }
    }

    private String composeMessage(String message, String payload) {
        String base = (payload == null || payload.isEmpty())
            ? message
            : message + " | " + payload;

        if (base.length() <= MAX_LOG_LENGTH) {
            return base;
        }

        return base.substring(0, MAX_LOG_LENGTH) + "...(truncated)";
    }
}
