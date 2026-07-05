package com.membershipdeliverydriver.app.core

import android.content.Context

object AppContextHolder {
    private var appContext: Context? = null

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    fun requireContext(): Context {
        return requireNotNull(appContext) { "App context 尚未初始化。" }
    }
}
