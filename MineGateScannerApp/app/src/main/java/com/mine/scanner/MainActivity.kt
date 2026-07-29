package com.mine.scanner

import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.mine.scanner.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var networkClient: NetworkClient
    private lateinit var hardwareManager: HardwareManager
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Replace with actual server IP running app.py
        networkClient = NetworkClient("http://192.168.1.100:8080")

        hardwareManager = HardwareManager(this)
        hardwareManager.initialize()

        hardwareManager.onBarcodeScanned = { barcode ->
            runOnUiThread {
                binding.tvStatus.text = "Scanned Barcode: $barcode\nSending to server..."
                networkClient.submitBarcode(barcode) { response ->
                    handleScanResponse(response)
                }
            }
        }

        hardwareManager.onRfidScanned = { rfid ->
            runOnUiThread {
                binding.tvStatus.text = "Scanned RFID: $rfid\nSending to server..."
                networkClient.submitRfid(rfid) { response ->
                    handleScanResponse(response)
                }
            }
        }

        binding.btnSimulateBarcode.setOnClickListener {
            hardwareManager.triggerBarcodeScan()
        }

        binding.btnSimulateRfid.setOnClickListener {
            hardwareManager.startRfidInventory()
        }
    }

    private fun handleScanResponse(response: ScanResponse?) {
        runOnUiThread {
            if (response == null) {
                showFeedback(false, "Unknown Error", "Failed to connect to server")
                return@runOnUiThread
            }
            showFeedback(response.success, response.entity_name ?: "Unknown", response.message)
        }
    }

    private fun showFeedback(isSuccess: Boolean, title: String, message: String) {
        binding.resultOverlay.visibility = View.VISIBLE
        binding.tvResultName.text = title
        binding.tvResultMessage.text = message

        if (isSuccess) {
            binding.resultOverlay.setBackgroundColor(Color.parseColor("#CC2E7D32")) // Green
        } else {
            binding.resultOverlay.setBackgroundColor(Color.parseColor("#CCC62828")) // Red
        }

        // Hide overlay after 3 seconds
        handler.removeCallbacksAndMessages(null)
        handler.postDelayed({
            binding.resultOverlay.visibility = View.GONE
            binding.tvStatus.text = "Status: Ready"
        }, 3000)
    }

    override fun onDestroy() {
        super.onDestroy()
        hardwareManager.onDestroy()
    }
}
