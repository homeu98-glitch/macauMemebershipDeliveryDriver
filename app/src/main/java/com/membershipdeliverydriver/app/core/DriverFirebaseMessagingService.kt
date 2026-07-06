package com.membershipdeliverydriver.app.core

import android.app.PendingIntent
import android.content.Intent
import android.graphics.BitmapFactory
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.membershipdeliverydriver.app.MainActivity
import com.membershipdeliverydriver.app.R
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

        if (updateType == "order_invalidated") {
            sendBroadcast(Intent(ACTION_ORDER_UPDATED))
            return
        }

        val title =
            message.notification?.title ?: message.data["title"] ?: "配送通知"
        val body =
            message.notification?.body ?: message.data["body"] ?: "你有新的配送更新。"

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            9090,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, DriverNotifications.channelIdFor(soundKey))
            .setSmallIcon(R.mipmap.ic_launcher_round)
            .setLargeIcon(BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher_round))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        NotificationManagerCompat.from(this).notify(
            (System.currentTimeMillis() % 100000).toInt(),
            notification
        )

        sendBroadcast(Intent(ACTION_ORDER_UPDATED))
    }

    companion object {
        const val ACTION_ORDER_UPDATED = "com.membershipdeliverydriver.app.ORDER_UPDATED"
    }
}
