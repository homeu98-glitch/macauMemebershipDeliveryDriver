package com.membershipdeliverydriver.app.core

import android.app.Service
import android.content.Intent
import android.os.IBinder

class DriverDispatchService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }

            else -> {
                val driverName = intent?.getStringExtra(EXTRA_DRIVER_NAME) ?: "騎手"
                startForeground(
                    DriverNotifications.foregroundNotificationId(),
                    DriverNotifications.createForegroundNotification(this, driverName)
                )
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_START = "com.membershipdeliverydriver.app.dispatch.START"
        const val ACTION_STOP = "com.membershipdeliverydriver.app.dispatch.STOP"
        const val EXTRA_DRIVER_NAME = "driver_name"
    }
}
