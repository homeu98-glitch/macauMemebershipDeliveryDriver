package com.membershipdeliverydriver.app.core

import android.content.Intent
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class DriverFirebaseMessagingService : FirebaseMessagingService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val accessToken = DriverSessionStore.getAccessToken(applicationContext) ?: return
        serviceScope.launch {
            runCatching {
                FcmRegistrationManager.syncCurrentToken(accessToken)
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        DriverNotifications.initialize(this)
        DriverSessionStore.touchSession(applicationContext)
        DriverSessionStore.getAccessToken(applicationContext)?.let { accessToken ->
            serviceScope.launch {
                runCatching {
                    FcmRegistrationManager.syncCurrentToken(accessToken)
                }
            }
        }

        val soundKey = message.data["soundKey"]
        val updateType = message.data["type"]
        val shouldPlaySound =
            message.data["playSound"] == "true" ||
                soundKey == DriverNotifications.SOUND_URGENT_ORDER ||
                soundKey == DriverNotifications.SOUND_ORDER_CANCELLED
        DriverSessionStore.saveLastPushDebug(
            applicationContext,
            "FCM type=${updateType ?: "null"}, soundKey=${soundKey ?: "null"}, playSound=${message.data["playSound"] ?: "null"}, title=${message.data["title"] ?: message.notification?.title ?: "null"}"
        )

        if (updateType == "order_invalidated") {
            sendBroadcast(Intent(ACTION_ORDER_UPDATED))
            return
        }

        val title =
            message.notification?.title ?: message.data["title"] ?: "配送通知"
        val body =
            message.notification?.body ?: message.data["body"] ?: "你有新的配送更新。"

        DriverNotifications.showDispatchAlert(this, title, body, soundKey)

        if (shouldPlaySound) {
            DriverSoundEffects.playBySoundKey(applicationContext, soundKey)
        }

        sendBroadcast(Intent(ACTION_ORDER_UPDATED))
    }

    companion object {
        const val ACTION_ORDER_UPDATED = "com.membershipdeliverydriver.app.ORDER_UPDATED"
    }
}
