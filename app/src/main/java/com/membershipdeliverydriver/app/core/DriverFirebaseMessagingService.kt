package com.membershipdeliverydriver.app.core

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.membershipdeliverydriver.app.MainActivity
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

        val soundKey = message.data["soundKey"]
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
            .setSmallIcon(android.R.drawable.stat_notify_more)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setSound(null)
            .build()

        NotificationManagerCompat.from(this).notify(
            (System.currentTimeMillis() % 100000).toInt(),
            notification
        )
    }
}
