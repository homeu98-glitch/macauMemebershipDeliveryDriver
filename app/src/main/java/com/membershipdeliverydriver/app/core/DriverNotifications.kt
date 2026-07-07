package com.membershipdeliverydriver.app.core

import android.Manifest
import android.media.AudioAttributes
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.app.PendingIntent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.membershipdeliverydriver.app.R

object DriverNotifications {
    const val DISPATCH_CHANNEL_ID = "driver_dispatch_status"
    const val ORDER_ALERT_CHANNEL_ID = "driver_order_alerts_v2"
    const val URGENT_ORDER_ALERT_CHANNEL_ID = "driver_urgent_order_alerts_v2"
    const val CUSTOMER_HURRY_ALERT_CHANNEL_ID = "driver_customer_hurry_alerts"
    const val ORDER_COMPLETED_CHANNEL_ID = "driver_order_completed_alerts"
    const val ORDER_CANCELLED_CHANNEL_ID = "driver_order_cancelled_alerts_v2"
    const val ORDER_OVERDUE_ALERT_CHANNEL_ID = "driver_order_overdue_alerts"
    const val SOUND_NEW_ORDER = "new_order"
    const val SOUND_URGENT_ORDER = "urgent_order"
    const val SOUND_CUSTOMER_HURRY = "customer_hurry"
    const val SOUND_ORDER_COMPLETED = "order_completed"
    const val SOUND_ORDER_CANCELLED = "order_cancelled"
    const val SOUND_ORDER_OVERDUE = "order_overdue"
    private const val DISPATCH_NOTIFICATION_ID = 1010
    private const val ORDER_ALERT_BASE_ID = 2020

    fun initialize(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val dispatchChannel = NotificationChannel(
                DISPATCH_CHANNEL_ID,
                "派單狀態",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "顯示騎手目前是否上線與背景派單狀態。"
            }

            val orderAlertChannel = NotificationChannel(
                ORDER_ALERT_CHANNEL_ID,
                "新訂單提醒",
                NotificationManager.IMPORTANCE_HIGH,
            ).applyConfiguredSound(
                context = context,
                descriptionText = "有新可接訂單時發出提醒。",
                soundResId = R.raw.sound_new_order,
            )

            val urgentOrderChannel = NotificationChannel(
                URGENT_ORDER_ALERT_CHANNEL_ID,
                "急單提醒",
                NotificationManager.IMPORTANCE_HIGH,
            ).applyConfiguredSound(
                context = context,
                descriptionText = "有急單時發出提醒。",
                soundResId = R.raw.sound_urgent_order,
            )

            val customerHurryChannel = NotificationChannel(
                CUSTOMER_HURRY_ALERT_CHANNEL_ID,
                "客人催單提醒",
                NotificationManager.IMPORTANCE_HIGH,
            ).applyConfiguredSound(
                context = context,
                descriptionText = "客人催單時發出提醒。",
                soundResId = R.raw.sound_customer_hurry,
            )

            val orderCompletedChannel = NotificationChannel(
                ORDER_COMPLETED_CHANNEL_ID,
                "完成訂單提醒",
                NotificationManager.IMPORTANCE_HIGH,
            ).applyConfiguredSound(
                context = context,
                descriptionText = "訂單完成時發出提醒。",
                soundResId = R.raw.sound_order_completed,
            )

            val orderCancelledChannel = NotificationChannel(
                ORDER_CANCELLED_CHANNEL_ID,
                "取消訂單提醒",
                NotificationManager.IMPORTANCE_HIGH,
            ).applyConfiguredSound(
                context = context,
                descriptionText = "訂單被取消時發出提醒。",
                soundResId = R.raw.sound_order_cancelled,
            )

            val orderOverdueChannel = NotificationChannel(
                ORDER_OVERDUE_ALERT_CHANNEL_ID,
                "逾時訂單提醒",
                NotificationManager.IMPORTANCE_HIGH,
            ).applyConfiguredSound(
                context = context,
                descriptionText = "訂單超過承諾時間 30 分鐘仍未完成時發出提醒。",
                soundResId = R.raw.sound_order_overdue,
            )

            notificationManager.createNotificationChannel(dispatchChannel)
            notificationManager.createNotificationChannel(orderAlertChannel)
            notificationManager.createNotificationChannel(urgentOrderChannel)
            notificationManager.createNotificationChannel(customerHurryChannel)
            notificationManager.createNotificationChannel(orderCompletedChannel)
            notificationManager.createNotificationChannel(orderCancelledChannel)
            notificationManager.createNotificationChannel(orderOverdueChannel)
        }
    }

    fun startDispatchService(context: Context, driverId: String, driverName: String) {
        initialize(context)
        val intent = Intent(context, DriverDispatchService::class.java).apply {
            action = DriverDispatchService.ACTION_START
            putExtra(DriverDispatchService.EXTRA_DRIVER_NAME, driverName)
            putExtra(DriverDispatchService.EXTRA_DRIVER_ID, driverId)
        }
        ContextCompat.startForegroundService(context, intent)
    }

    fun stopDispatchService(context: Context) {
        val intent = Intent(context, DriverDispatchService::class.java).apply {
            action = DriverDispatchService.ACTION_STOP
        }
        context.startService(intent)
    }

    fun createForegroundNotification(context: Context, driverName: String): Notification {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent()
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(context, DISPATCH_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher_round)
            .setLargeIcon(BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher_round))
            .setContentTitle("配送中樞已啟動")
            .setContentText("$driverName 目前上線中，系統會持續留意新工單。")
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    fun notifyNewOrders(context: Context, count: Int, firstShopName: String?, urgent: Boolean = false) {
        if (!canPostNotifications(context)) return
        initialize(context)

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent()
        val pendingIntent = PendingIntent.getActivity(
            context,
            100 + count,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = if (count == 1) "有 1 張新工單" else "有 $count 張新工單"
        val message = if (!firstShopName.isNullOrBlank()) {
            "$firstShopName 已出現在可接訂單列表。"
        } else {
            "新的可接訂單已出現在首頁。"
        }

        val notification = NotificationCompat.Builder(
            context,
            channelIdFor(if (urgent) SOUND_URGENT_ORDER else SOUND_NEW_ORDER)
        )
            .setSmallIcon(R.mipmap.ic_launcher_round)
            .setLargeIcon(BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher_round))
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setDefaults(Notification.DEFAULT_ALL)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(context).notify(
            ORDER_ALERT_BASE_ID + (System.currentTimeMillis() % 1000).toInt(),
            notification
        )
    }


    fun showDispatchAlert(context: Context, title: String, body: String, soundKey: String?) {
        if (!canPostNotifications(context)) return
        initialize(context)

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
        val pendingIntent = PendingIntent.getActivity(
            context,
            9090,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelIdFor(soundKey))
            .setSmallIcon(R.mipmap.ic_launcher_round)
            .setLargeIcon(BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher_round))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        NotificationManagerCompat.from(context).notify(
            ORDER_ALERT_BASE_ID + (System.currentTimeMillis() % 1000).toInt(),
            notification
        )
    }

    fun foregroundNotificationId(): Int = DISPATCH_NOTIFICATION_ID

    fun channelIdFor(soundKey: String?): String {
        return when (soundKey) {
            SOUND_URGENT_ORDER -> URGENT_ORDER_ALERT_CHANNEL_ID
            SOUND_CUSTOMER_HURRY -> CUSTOMER_HURRY_ALERT_CHANNEL_ID
            SOUND_ORDER_COMPLETED -> ORDER_COMPLETED_CHANNEL_ID
            SOUND_ORDER_CANCELLED -> ORDER_CANCELLED_CHANNEL_ID
            SOUND_ORDER_OVERDUE -> ORDER_OVERDUE_ALERT_CHANNEL_ID
            else -> ORDER_ALERT_CHANNEL_ID
        }
    }

    fun soundNameFor(soundKey: String?): String {
        return when (soundKey) {
            SOUND_URGENT_ORDER -> "sound_urgent_order"
            SOUND_CUSTOMER_HURRY -> "sound_customer_hurry"
            SOUND_ORDER_COMPLETED -> "sound_order_completed"
            SOUND_ORDER_CANCELLED -> "sound_order_cancelled"
            SOUND_ORDER_OVERDUE -> "sound_order_overdue"
            else -> "sound_new_order"
        }
    }

    private fun canPostNotifications(context: Context): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
    }

    private fun NotificationChannel.applyConfiguredSound(
        context: Context,
        descriptionText: String,
        soundResId: Int,
    ): NotificationChannel = apply {
        description = descriptionText
        enableVibration(true)
        setSound(
            Uri.parse("android.resource://${context.packageName}/$soundResId"),
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        )
    }
}
