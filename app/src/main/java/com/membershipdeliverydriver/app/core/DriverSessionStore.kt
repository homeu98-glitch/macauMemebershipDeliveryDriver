package com.membershipdeliverydriver.app.core

import android.content.Context

object DriverSessionStore {
    private const val PREFS_NAME = "driver_session_store"
    private const val KEY_ACCESS_TOKEN = "access_token"
    private const val KEY_REFRESH_TOKEN = "refresh_token"
    private const val KEY_SAVED_AT = "saved_at"
    private const val SESSION_TTL_MS = 24L * 60L * 60L * 1000L

    fun saveSession(context: Context, accessToken: String, refreshToken: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putLong(KEY_SAVED_AT, System.currentTimeMillis())
            .apply()
    }

    fun getAccessToken(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedAt = prefs.getLong(KEY_SAVED_AT, 0L)
        if (savedAt == 0L || System.currentTimeMillis() - savedAt > SESSION_TTL_MS) {
            clear(context)
            return null
        }
        return prefs.getString(KEY_ACCESS_TOKEN, null)
    }

    fun getRefreshToken(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedAt = prefs.getLong(KEY_SAVED_AT, 0L)
        if (savedAt == 0L || System.currentTimeMillis() - savedAt > SESSION_TTL_MS) {
            clear(context)
            return null
        }
        return prefs.getString(KEY_REFRESH_TOKEN, null)
    }

    fun getSavedAt(context: Context): Long {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getLong(KEY_SAVED_AT, 0L)
    }

    fun touchSession(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.contains(KEY_ACCESS_TOKEN) || !prefs.contains(KEY_REFRESH_TOKEN)) return
        prefs.edit()
            .putLong(KEY_SAVED_AT, System.currentTimeMillis())
            .apply()
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_SAVED_AT)
            .apply()
    }
}
