package com.mine.c66bridge

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.KeyEvent
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val TARGET_URL = "http://192.168.1.79:8080/scanner?link=true" // Change to your IP/Tunnel

    // Receiver to catch scans from InfoWedge
    private val scanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action
            if (action != null) {
                // InfoWedge / Chainway default extras for barcode data
                val barcode = intent.getStringExtra("scannerdata") ?: 
                              intent.getStringExtra("barcode") ?: 
                              intent.getStringExtra("data") ?: 
                              intent.getStringExtra("barcode_string")
                              
                if (!barcode.isNullOrEmpty()) {
                    // Send directly to the web page via JavaScript
                    runOnUiThread {
                        webView.evaluateJavascript("window.onNativeScanReceived('$barcode');", null)
                    }
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
        setContentView(webView)

        // Setup WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_NO_CACHE
        }

        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = WebViewClient()

        // Inject the native bridge
        webView.addJavascriptInterface(HardwareBridge(this), "ChainwayHardware")

        // Load the scanner PWA
        webView.loadUrl(TARGET_URL)

        // Register the broadcast receiver for scanner intents
        val filter = IntentFilter().apply {
            addAction("com.scanner.broadcast")
            addAction("android.intent.ACTION_DECODE_DATA")
            addAction("com.rsc.scan.action")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(scanReceiver, filter, RECEIVER_EXPORTED)
        } else {
            registerReceiver(scanReceiver, filter)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(scanReceiver)
    }

    // Hardware Bridge accessible from JS
    inner class HardwareBridge(private val context: Context) {
        
        @JavascriptInterface
        fun errorFeedback() {
            // 1. Play loud error tone
            try {
                val toneGen = ToneGenerator(AudioManager.STREAM_ALARM, 100)
                toneGen.startTone(ToneGenerator.TONE_CDMA_ABBR_INTERCEPT, 500)
            } catch (e: Exception) {
                e.printStackTrace()
            }

            // 2. Vibrate aggressively
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(500, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(500)
            }
        }

        @JavascriptInterface
        fun triggerLaser() {
            // Broadcast intent to tell InfoWedge to start scanning
            // Note: Intent action varies by device. Common Chainway trigger intent:
            val intent = Intent("com.rsc.scan.action.START")
            context.sendBroadcast(intent)
            
            // Alternative fallback: inject keycode 139 (SCAN key)
            // (Requires Accessibility Service or root to inject globally, 
            // but intent is preferred for InfoWedge)
        }
    }
}
