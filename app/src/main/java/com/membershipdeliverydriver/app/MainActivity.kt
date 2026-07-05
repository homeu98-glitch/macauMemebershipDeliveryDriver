package com.membershipdeliverydriver.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import com.membershipdeliverydriver.app.core.AppContextHolder
import com.membershipdeliverydriver.app.core.DriverNotifications
import com.membershipdeliverydriver.app.ui.MembershipDriverTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AppContextHolder.init(this)
        DriverNotifications.initialize(this)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContent {
            MembershipDriverTheme {
                DriverApp()
            }
        }
    }
}
