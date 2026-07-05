package com.membershipdeliverydriver.app.core

import com.membershipdeliverydriver.app.BuildConfig

object ApiConfig {
    val baseUrl: String = BuildConfig.API_BASE_URL
    val jwtIssuer: String = BuildConfig.JWT_ISSUER
    val jwtAudience: String = BuildConfig.JWT_AUDIENCE

    fun isConfigured(): Boolean {
        return baseUrl.isNotBlank() &&
            !baseUrl.contains("your-api.example.com")
    }
}
