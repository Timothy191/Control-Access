package com.mine.c66bridge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ScanReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        val action = intent?.action
        if (action != null) {
            val barcode = intent.getStringExtra("scannerdata") ?: 
                          intent.getStringExtra("barcode") ?: 
                          intent.getStringExtra("data") ?: 
                          intent.getStringExtra("barcode_string")
                          
            if (!barcode.isNullOrEmpty()) {
                MainActivity.instance?.dispatchScanToWeb(barcode)
            }
        }
    }
}
