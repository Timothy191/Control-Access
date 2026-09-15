package com.mine.c66bridge;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Industrial Chainway C66 RFID & Barcode Intent Receiver
 */
public class ScanReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String tagData = intent.getStringExtra("scannerdata");
        if (tagData == null) tagData = intent.getStringExtra("barcode");
        if (tagData == null) tagData = intent.getStringExtra("data");
        if (tagData == null) tagData = intent.getStringExtra("barcode_string");
        if (tagData == null) tagData = intent.getStringExtra("tag_id");
        if (tagData == null) tagData = intent.getStringExtra("epc");
        if (tagData == null) tagData = intent.getStringExtra("extra_rfid_data");
        if (tagData == null) tagData = intent.getStringExtra("tag_epc");

        if (tagData == null) {
            byte[] rawBytes = intent.getByteArrayExtra("data");
            if (rawBytes != null && rawBytes.length > 0) {
                tagData = new String(rawBytes).trim();
            }
        }

        if (tagData != null && !tagData.trim().isEmpty()) {
            MainActivity inst = MainActivity.getInstance();
            if (inst != null) {
                inst.dispatchScan(tagData.trim(), "BroadcastIntent: " + intent.getAction());
            }
        }
    }
}
