package com.mine.c66bridge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Global Chainway C66 RFID and Barcode Intent Receiver
 */
class ScanReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        val action = intent?.action ?: return
        
        val tagData = intent.getStringExtra("scannerdata")
            ?: intent.getStringExtra("barcode")
            ?: intent.getStringExtra("data")
            ?: intent.getStringExtra("barcode_string")
            ?: intent.getStringExtra("tag_id")
            ?: intent.getStringExtra("epc")
            ?: intent.getStringExtra("extra_rfid_data")
            ?: intent.getStringExtra("tag_epc")
            ?: intent.getByteArrayExtra("data")?.let { String(it).trim() }

        if (!tagData.isNullOrEmpty()) {
            MainActivity.instance?.dispatchScanToWeb(tagData.trim())
        }
    }
}
