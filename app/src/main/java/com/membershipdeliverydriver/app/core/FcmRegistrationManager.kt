package com.membershipdeliverydriver.app.core

import android.os.Build
import com.membershipdeliverydriver.app.BuildConfig
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

object FcmRegistrationManager {
    private val client = OkHttpClient()

    suspend fun syncCurrentToken(accessToken: String) {
        if (BuildConfig.API_BASE_URL.contains("your-api.example.com")) return

        val token = FirebaseMessaging.getInstance().token.await()
        val requestBody = JSONObject()
            .put("fcmToken", token)
            .put("platform", "android")
            .put("deviceLabel", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
            .put("appVersion", BuildConfig.VERSION_NAME)
            .toString()

        val request = Request.Builder()
            .url("${BuildConfig.API_BASE_URL.trimEnd('/')}/api/mobile/push/register")
            .post(requestBody.toRequestBody("application/json".toMediaType()))
            .addHeader("Content-Type", "application/json")
            .addHeader("x-supabase-access-token", accessToken)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException("FCM token registration failed: ${response.code}")
            }
        }
    }
}
