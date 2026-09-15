package com.mine.c66bridge

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    companion object {
        var instance: MainActivity? = null
    }

    private lateinit var webView: WebView
    private lateinit var prefs: SharedPreferences
    private val DEFAULT_TARGET_URL = "https://vocational-damages-calculated-are.trycloudflare.com/scanner?link=true"

    fun dispatchScanToWeb(barcode: String) {
        runOnUiThread {
            webView.evaluateJavascript("if(window.onNativeScanReceived){window.onNativeScanReceived('$barcode');}", null)
        }
    }

    // Dynamic broadcast receiver for InfoWedge scans
    private val scanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action
            if (action != null) {
                val barcode = intent.getStringExtra("scannerdata") ?: 
                              intent.getStringExtra("barcode") ?: 
                              intent.getStringExtra("data") ?: 
                              intent.getStringExtra("barcode_string")
                              
                if (!barcode.isNullOrEmpty()) {
                    dispatchScanToWeb(barcode)
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this
        
        prefs = getSharedPreferences("c66_scanner_prefs", Context.MODE_PRIVATE)
        val targetUrl = prefs.getString("scanner_url", DEFAULT_TARGET_URL) ?: DEFAULT_TARGET_URL

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
        webView.loadUrl(targetUrl)

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
        instance = null
        try {
            unregisterReceiver(scanReceiver)
        } catch (e: Exception) {
            // ignore
        }
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
        fun successFeedback() {
            try {
                val toneGen = ToneGenerator(AudioManager.STREAM_MUSIC, 80)
                toneGen.startTone(ToneGenerator.TONE_PROP_BEEP2, 200)
            } catch (e: Exception) {
                e.printStackTrace()
            }

            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(80)
            }
        }

        @JavascriptInterface
        fun triggerLaser() {
            val intent = Intent("com.rsc.scan.action.START")
            context.sendBroadcast(intent)
        }

        @JavascriptInterface
        fun saveTunnelConfig(tunnelUrl: String, deviceId: String) {
            val fullUrl = "$tunnelUrl/scanner?link=true&device=$deviceId"
            prefs.edit().putString("scanner_url", fullUrl).apply()
            runOnUiThread {
                webView.loadUrl(fullUrl)
            }
        }
    }
}
