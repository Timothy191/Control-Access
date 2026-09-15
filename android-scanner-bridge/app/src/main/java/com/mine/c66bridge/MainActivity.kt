package com.mine.c66bridge

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.graphics.PixelFormat
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Gravity
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Dedicated Chainway C66 Industrial Android Scanner Bridge & Native Companion
 * 
 * Features:
 * 1. Captures physical C66 Pistol Grip triggers (KeyCode 139) and side buttons (KeyCode 280, 293, 294).
 * 2. Catches all Chainway UHF RFID & 2D barcode broadcast intents (com.rsc, com.scanner.broadcast).
 * 3. Provides a floating industrial glove-friendly Screen Overlay Trigger Button.
 * 4. Dispatches scans directly to Control-Access Mine Site Server over Cloudflare Tunnel & LAN.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        var instance: MainActivity? = null
        const val ACTIVE_SERVER_URL = "https://advantage-headset-tobago-periodic.trycloudflare.com"
        const val DEFAULT_TARGET_URL = "$ACTIVE_SERVER_URL/scanner?link=true"
    }

    private lateinit var webView: WebView
    private lateinit var prefs: SharedPreferences
    private var floatingOverlayView: View? = null

    fun dispatchScanToWeb(barcode: String) {
        runOnUiThread {
            webView.evaluateJavascript("if(window.onNativeScanReceived){window.onNativeScanReceived('$barcode');}", null)
            Toast.makeText(this, "Tag Sent to PC: $barcode", Toast.LENGTH_SHORT).show()
        }

        // Also post asynchronously directly to Control-Access server to guarantee PC screen updates
        thread {
            try {
                val serverUrl = prefs.getString("server_base_url", ACTIVE_SERVER_URL) ?: ACTIVE_SERVER_URL
                val endpoint = URL("$serverUrl/api/scanner/receive")
                val conn = endpoint.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("User-Agent", "Chainway-C66-NativeBridge/2.0")
                conn.connectTimeout = 4000
                conn.readTimeout = 4000
                conn.doOutput = true

                val payload = JSONObject().apply {
                    put("rawData", barcode)
                    put("rfidTag", barcode)
                    put("barcodeData", barcode)
                    put("deviceId", prefs.getString("device_id", "Chainway-C66-01"))
                    put("deviceType", "Chainway C66 UHF Handheld")
                    put("gateLocation", prefs.getString("gate_location", "Main Ingress Gate 1"))
                    put("operator", "C66 Native Hardware Bridge")
                }

                OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()) }
                val responseCode = conn.responseCode
                if (responseCode in 200..299) {
                    successFeedback()
                } else {
                    errorFeedback()
                }
                conn.disconnect()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // Dynamic broadcast receiver for Chainway UHF and Barcode intents
    private val scanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action ?: return
            
            // Extract tag / barcode from all known Chainway and Android Wedge extras
            val barcode = intent.getStringExtra("scannerdata")
                ?: intent.getStringExtra("barcode")
                ?: intent.getStringExtra("data")
                ?: intent.getStringExtra("barcode_string")
                ?: intent.getStringExtra("tag_id")
                ?: intent.getStringExtra("epc")
                ?: intent.getStringExtra("extra_rfid_data")
                ?: intent.getStringExtra("tag_epc")
                ?: intent.getByteArrayExtra("data")?.let { String(it).trim() }

            if (!barcode.isNullOrEmpty()) {
                dispatchScanToWeb(barcode.trim())
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this

        prefs = getSharedPreferences("c66_scanner_prefs", Context.MODE_PRIVATE)
        val targetUrl = prefs.getString("scanner_url", DEFAULT_TARGET_URL) ?: DEFAULT_TARGET_URL

        val rootLayout = FrameLayout(this)
        webView = WebView(this)
        rootLayout.addView(webView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)

        // Setup Floating Industrial Screen Overlay Button
        val overlayButton = Button(this).apply {
            text = "⚡ TRIGGER SCAN"
            textSize = 14f
            setBackgroundColor(0xFF007AFF.toInt())
            setTextColor(0xFFFFFFFF.toInt())
            setPadding(32, 24, 32, 24)
            elevation = 16f
            setOnClickListener {
                triggerLaserHardware()
            }
        }

        val overlayParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            setMargins(0, 0, 36, 180)
        }
        rootLayout.addView(overlayButton, overlayParams)

        setContentView(rootLayout)

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

        // Register the broadcast receiver for all Chainway C66 scanner actions
        val filter = IntentFilter().apply {
            addAction("com.scanner.broadcast")
            addAction("android.intent.ACTION_DECODE_DATA")
            addAction("com.rsc.scan.action")
            addAction("com.rsc.action.UHF_RECEIVE_DATA")
            addAction("com.android.server.scannerservice.broadcast")
            addAction("com.rfid.KEY_DOWN")
            addAction("android.rfid.FUN_KEY")
            addAction("nl.chainway.rfid.TAG_READ")
            addAction("com.ubx.datawedge.TAG_DATA")
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(scanReceiver, filter, RECEIVER_EXPORTED)
        } else {
            registerReceiver(scanReceiver, filter)
        }
    }

    /**
     * Intercept physical C66 Pistol Grip Trigger (139) & Side Scan Keys (280, 293, 294)
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == 139 || keyCode == 280 || keyCode == 293 || keyCode == 294 || keyCode == KeyEvent.KEYCODE_BUTTON_L1) {
            triggerLaserHardware()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    fun triggerLaserHardware() {
        // Broadcast Chainway hardware trigger intents
        val scanIntent = Intent("com.rsc.scan.action.START")
        sendBroadcast(scanIntent)

        val uhfIntent = Intent("com.rsc.action.UHF_START_SCAN")
        sendBroadcast(uhfIntent)

        runOnUiThread {
            webView.evaluateJavascript("if(window.handleTriggerHardwareScan){window.handleTriggerHardwareScan();}", null)
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

    fun errorFeedback() {
        try {
            val toneGen = ToneGenerator(AudioManager.STREAM_ALARM, 100)
            toneGen.startTone(ToneGenerator.TONE_CDMA_ABBR_INTERCEPT, 500)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(500, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(500)
        }
    }

    fun successFeedback() {
        try {
            val toneGen = ToneGenerator(AudioManager.STREAM_MUSIC, 80)
            toneGen.startTone(ToneGenerator.TONE_PROP_BEEP2, 200)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(80)
        }
    }

    inner class HardwareBridge(private val context: Context) {
        @JavascriptInterface
        fun errorFeedback() = this@MainActivity.errorFeedback()

        @JavascriptInterface
        fun successFeedback() = this@MainActivity.successFeedback()

        @JavascriptInterface
        fun triggerLaser() = this@MainActivity.triggerLaserHardware()

        @JavascriptInterface
        fun saveTunnelConfig(tunnelUrl: String, deviceId: String) {
            val fullUrl = "$tunnelUrl/scanner?link=true&device=$deviceId"
            prefs.edit().apply {
                putString("scanner_url", fullUrl)
                putString("server_base_url", tunnelUrl)
                putString("device_id", deviceId)
                apply()
            }
            runOnUiThread {
                webView.loadUrl(fullUrl)
            }
        }
    }
}
