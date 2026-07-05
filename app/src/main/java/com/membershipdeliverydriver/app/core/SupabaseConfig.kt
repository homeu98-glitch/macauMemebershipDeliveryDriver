package com.membershipdeliverydriver.app.core

import com.membershipdeliverydriver.app.BuildConfig

object SupabaseConfig {
    const val configNote =
        "Client app uses only Supabase URL and anon key. Never embed service_role in Android."

    val url: String = BuildConfig.SUPABASE_URL
    val anonKey: String = BuildConfig.SUPABASE_ANON_KEY

    fun isConfigured(): Boolean {
        return url.isNotBlank() &&
            anonKey.isNotBlank() &&
            !url.contains("your-project") &&
            !anonKey.contains("replace-with-your-anon-key")
    }
}
