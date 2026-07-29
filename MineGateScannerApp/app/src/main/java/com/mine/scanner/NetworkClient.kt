package com.mine.scanner

import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST

data class ScanRequest(
    val qr_code: String? = null,
    val rfid_tag: String? = null,
    val direction: String = "IN",
    val gate_location: String = "C66 Native Scanner",
    val reader_id: String = "C66-001"
)

data class ScanResponse(
    val success: Boolean,
    val message: String,
    val entity_type: String?,
    val entity_name: String?,
    val open_gate: Boolean,
    val denial_reason: String?
)

interface ApiService {
    @POST("/api/scan_qr")
    fun sendBarcodeScan(@Body request: ScanRequest): Call<ScanResponse>

    @POST("/api/scan_rfid")
    fun sendRfidScan(@Body request: ScanRequest): Call<ScanResponse>
}

class NetworkClient(baseUrl: String) {
    private val retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    private val api = retrofit.create(ApiService::class.java)

    fun submitBarcode(barcode: String, onResult: (ScanResponse?) -> Unit) {
        val request = ScanRequest(qr_code = barcode)
        api.sendBarcodeScan(request).enqueue(object : Callback<ScanResponse> {
            override fun onResponse(call: Call<ScanResponse>, response: Response<ScanResponse>) {
                onResult(response.body())
            }
            override fun onFailure(call: Call<ScanResponse>, t: Throwable) {
                onResult(ScanResponse(false, "Network Error: ${t.message}", null, null, false, t.message))
            }
        })
    }

    fun submitRfid(rfidTag: String, onResult: (ScanResponse?) -> Unit) {
        val request = ScanRequest(rfid_tag = rfidTag)
        api.sendRfidScan(request).enqueue(object : Callback<ScanResponse> {
            override fun onResponse(call: Call<ScanResponse>, response: Response<ScanResponse>) {
                onResult(response.body())
            }
            override fun onFailure(call: Call<ScanResponse>, t: Throwable) {
                onResult(ScanResponse(false, "Network Error: ${t.message}", null, null, false, t.message))
            }
        })
    }
}
