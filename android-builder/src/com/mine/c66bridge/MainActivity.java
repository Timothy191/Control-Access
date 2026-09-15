package com.mine.c66bridge;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Control-Access Mine Site Security - Chainway C66 Industrial Android Companion
 */
public class MainActivity extends Activity {

    public static final String CLOUDFLARE_URL = "https://advantage-headset-tobago-periodic.trycloudflare.com";
    public static final String DEFAULT_KIOSK_URL = CLOUDFLARE_URL + "/scanner?link=true";

    private static MainActivity sInstance;

    private WebView mWebView;
    private StringBuilder mKeyWedgeBuffer = new StringBuilder();
    private long mLastKeyTimestamp = 0;
    private Vibrator mVibrator;
    private ToneGenerator mToneGenerator;
    private SharedPreferences mPrefs;
    private ScanReceiver mScanReceiver;

    public static MainActivity getInstance() {
        return sInstance;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        sInstance = this;

        // Keep screen alive during shifts
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        mPrefs = getSharedPreferences("c66_bridge_prefs", MODE_PRIVATE);

        try {
            mVibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            mToneGenerator = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 90);
        } catch (Throwable ignored) {}

        // Root container
        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        rootLayout.setBackgroundColor(Color.parseColor("#09090b"));

        // Fullscreen WebView
        mWebView = new WebView(this);
        mWebView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        mWebView.setBackgroundColor(Color.parseColor("#09090b"));

        configureWebSettings(mWebView.getSettings());

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });

        mWebView.setWebChromeClient(new WebChromeClient());

        rootLayout.addView(mWebView);

        // Add Floating Glove Screen Overlay Button for Industrial Heavy Gloves
        addFloatingGloveOverlay(rootLayout);

        setContentView(rootLayout);

        // Load configured Kiosk URL
        String targetUrl = mPrefs.getString("target_url", DEFAULT_KIOSK_URL);
        mWebView.loadUrl(targetUrl);

        // Register Dynamic Broadcast Filters for all known UHF/Barcode Scanner vendors
        registerScannerReceivers();
    }

    private void configureWebSettings(WebSettings settings) {
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setDisplayZoomControls(false);
        settings.setUserAgentString("Chainway-C66-Companion/2.1 (Industrial UHF; Linux; Android)");
    }

    private void addFloatingGloveOverlay(FrameLayout rootLayout) {
        LinearLayout overlayContainer = new LinearLayout(this);
        overlayContainer.setOrientation(LinearLayout.VERTICAL);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        params.gravity = Gravity.BOTTOM;
        params.setMargins(24, 0, 24, 28);
        overlayContainer.setLayoutParams(params);

        Button triggerBtn = new Button(this);
        triggerBtn.setText("⚡ SCAN RFID / BARCODE (OVERLAY)");
        triggerBtn.setTextColor(Color.WHITE);
        triggerBtn.setTextSize(14f);
        triggerBtn.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        triggerBtn.setMinHeight(140); // > 54dp industrial touch target

        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setColor(Color.parseColor("#059669")); // Emerald green
        btnBg.setCornerRadius(28f);
        btnBg.setStroke(3, Color.parseColor("#34D399"));
        triggerBtn.setBackground(btnBg);

        triggerBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                // Broadcast scanner trigger intent to activate hardware laser/UHF antenna
                triggerHardwareAntenna();
                // Notify web interface of manual trigger
                mWebView.evaluateJavascript("if(window.simulateScannerTap){window.simulateScannerTap();}", null);
            }
        });

        // Long press opens target server switch dialog
        triggerBtn.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                switchTargetServer();
                return true;
            }
        });

        overlayContainer.addView(triggerBtn);
        rootLayout.addView(overlayContainer);
    }

    private void triggerHardwareAntenna() {
        try {
            // Standard Chainway laser/UHF trigger broadcast
            Intent intent = new Intent("com.scanner.broadcast.scan");
            sendBroadcast(intent);

            Intent intent2 = new Intent("com.rsc.scan.action.START");
            sendBroadcast(intent2);

            hapticToneFeedback();
        } catch (Throwable ignored) {}
    }

    private void switchTargetServer() {
        String current = mPrefs.getString("target_url", DEFAULT_KIOSK_URL);
        String next = current.contains("trycloudflare.com")
                ? "http://192.168.1.100:8080/scanner?link=true"
                : DEFAULT_KIOSK_URL;

        mPrefs.edit().putString("target_url", next).apply();
        Toast.makeText(this, "Switched Target to: " + next, Toast.LENGTH_LONG).show();
        mWebView.loadUrl(next);
    }

    private void registerScannerReceivers() {
        mScanReceiver = new ScanReceiver();
        IntentFilter filter = new IntentFilter();
        filter.addAction("com.scanner.broadcast");
        filter.addAction("android.intent.ACTION_DECODE_DATA");
        filter.addAction("com.rsc.scan.action");
        filter.addAction("com.rsc.action.UHF_RECEIVE_DATA");
        filter.addAction("com.android.server.scannerservice.broadcast");
        filter.addAction("com.rfid.KEY_DOWN");
        filter.addAction("android.rfid.FUN_KEY");
        filter.addAction("nl.chainway.rfid.TAG_READ");
        filter.addAction("com.ubx.datawedge.TAG_DATA");
        registerReceiver(mScanReceiver, filter);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            int keyCode = event.getKeyCode();

            // Intercept Chainway C66 Pistol Grip & Side Hardware buttons
            if (keyCode == 139 || keyCode == 280 || keyCode == 293 || keyCode == 294) {
                triggerHardwareAntenna();
                return true;
            }

            // Keyboard wedge interceptor
            long now = System.currentTimeMillis();
            if (now - mLastKeyTimestamp > 250) {
                mKeyWedgeBuffer.setLength(0);
            }
            mLastKeyTimestamp = now;

            if (keyCode == KeyEvent.KEYCODE_ENTER) {
                String fullTag = mKeyWedgeBuffer.toString().trim();
                mKeyWedgeBuffer.setLength(0);
                if (!fullTag.isEmpty()) {
                    dispatchScan(fullTag, "HardwareWedgeKeycode");
                    return true;
                }
            } else {
                char unicodeChar = (char) event.getUnicodeChar();
                if (unicodeChar >= 32 && unicodeChar <= 126) {
                    mKeyWedgeBuffer.append(unicodeChar);
                }
            }
        }
        return super.dispatchKeyEvent(event);
    }

    public void dispatchScan(final String tag, final String source) {
        hapticToneFeedback();

        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                // 1. Deliver to WebView client
                String js = "if(window.onNativeScanReceived){window.onNativeScanReceived('" + tag + "');}";
                mWebView.evaluateJavascript(js, null);
                Toast.makeText(MainActivity.this, "Scan Streamed: " + tag, Toast.LENGTH_SHORT).show();
            }
        });

        // 2. Deliver asynchronous HTTP POST directly to server to update PC dashboard in real-time
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String serverBase = CLOUDFLARE_URL;
                    String target = mPrefs.getString("target_url", DEFAULT_KIOSK_URL);
                    if (!target.contains("trycloudflare.com")) {
                        try {
                            URL u = new URL(target);
                            serverBase = u.getProtocol() + "://" + u.getAuthority();
                        } catch (Exception ignored) {}
                    }

                    URL endpoint = new URL(serverBase + "/api/scanner/receive");
                    HttpURLConnection conn = (HttpURLConnection) endpoint.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setRequestProperty("User-Agent", "Chainway-C66-Companion/2.1");
                    conn.setConnectTimeout(4000);
                    conn.setReadTimeout(4000);
                    conn.setDoOutput(true);

                    String json = "{"
                            + "\"rawData\":\"" + tag + "\","
                            + "\"rfidTag\":\"" + tag + "\","
                            + "\"barcodeData\":\"" + tag + "\","
                            + "\"deviceId\":\"Chainway-C66-01\","
                            + "\"deviceType\":\"Chainway C66 UHF Handheld\","
                            + "\"gateLocation\":\"Main Ingress Gate 1\","
                            + "\"operator\":\"C66 Hardware Trigger Companion (" + source + ")\""
                            + "}";

                    byte[] out = json.getBytes(StandardCharsets.UTF_8);
                    conn.setFixedLengthStreamingMode(out.length);
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(out);
                    }
                    int code = conn.getResponseCode();
                    conn.disconnect();
                } catch (Throwable t) {
                    t.printStackTrace();
                }
            }
        }).start();
    }

    private void hapticToneFeedback() {
        try {
            if (mVibrator != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    mVibrator.vibrate(VibrationEffect.createOneShot(55, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    mVibrator.vibrate(55);
                }
            }
            if (mToneGenerator != null) {
                mToneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, 70);
            }
        } catch (Throwable ignored) {}
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (mScanReceiver != null) {
            try {
                unregisterReceiver(mScanReceiver);
            } catch (Throwable ignored) {}
        }
        if (sInstance == this) {
            sInstance = null;
        }
    }
}
