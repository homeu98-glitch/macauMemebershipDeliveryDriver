package com.membershipdeliverydriver.app.core

import android.content.Context
import android.content.Intent
import com.membershipdeliverydriver.app.BuildConfig
import java.nio.charset.StandardCharsets
import java.util.UUID
import javax.net.ssl.SSLSocketFactory
import org.eclipse.paho.client.mqttv3.IMqttActionListener
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken
import org.eclipse.paho.client.mqttv3.MqttAsyncClient
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended
import org.eclipse.paho.client.mqttv3.MqttConnectOptions
import org.eclipse.paho.client.mqttv3.MqttException
import org.eclipse.paho.client.mqttv3.MqttMessage
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence
import org.json.JSONObject

object DriverMqttManager {
    const val ACTION_ORDER_UPDATED = "com.membershipdeliverydriver.app.ORDER_UPDATED"
    private var client: MqttAsyncClient? = null
    private var activeDriverId: String? = null

    fun connect(context: Context, driverId: String) {
        val appContext = context.applicationContext
        if (!BuildConfig.MQTT_ENABLED || BuildConfig.MQTT_HOST.isBlank() || BuildConfig.MQTT_USERNAME.isBlank() || BuildConfig.MQTT_PASSWORD.isBlank()) {
            android.util.Log.w("DriverMqttManager", "MQTT disabled: missing config")
            return
        }
        if (client?.isConnected == true && activeDriverId == driverId) return

        disconnect(appContext)

        val serverUri = "ssl://${BuildConfig.MQTT_HOST}:${BuildConfig.MQTT_PORT}"
        val clientId = "driver-${driverId.take(8)}-${UUID.randomUUID().toString().take(8)}"
        val mqttClient = MqttAsyncClient(serverUri, clientId, MemoryPersistence())
        activeDriverId = driverId
        client = mqttClient

        mqttClient.setCallback(object : MqttCallbackExtended {
            override fun connectComplete(reconnect: Boolean, serverURI: String?) {
                android.util.Log.i("DriverMqttManager", "MQTT connected: driver=$driverId, reconnect=$reconnect")
                subscribe(appContext, mqttClient, driverId)
            }

            override fun connectionLost(cause: Throwable?) {
                android.util.Log.w("DriverMqttManager", "MQTT lost: ${cause?.message ?: "unknown"}")
            }

            override fun messageArrived(topic: String?, message: MqttMessage?) {
                handleMessage(appContext, topic.orEmpty(), message)
            }

            override fun deliveryComplete(token: IMqttDeliveryToken?) = Unit
        })

        val options = MqttConnectOptions().apply {
            isAutomaticReconnect = true
            isCleanSession = true
            userName = BuildConfig.MQTT_USERNAME
            password = BuildConfig.MQTT_PASSWORD.toCharArray()
            connectionTimeout = 10
            keepAliveInterval = 20
            socketFactory = SSLSocketFactory.getDefault() as SSLSocketFactory
        }

        mqttClient.connect(options, null, object : IMqttActionListener {
            override fun onSuccess(asyncActionToken: org.eclipse.paho.client.mqttv3.IMqttToken?) {
                android.util.Log.i("DriverMqttManager", "MQTT connect requested: driver=$driverId")
            }

            override fun onFailure(asyncActionToken: org.eclipse.paho.client.mqttv3.IMqttToken?, exception: Throwable?) {
                android.util.Log.e("DriverMqttManager", "MQTT connect failed: ${exception?.message ?: "unknown"}")
            }
        })
    }

    fun disconnect(context: Context) {
        val mqttClient = client ?: return
        runCatching {
            if (mqttClient.isConnected) {
                mqttClient.disconnect()
            }
        }
        runCatching { mqttClient.close() }
        android.util.Log.i("DriverMqttManager", "MQTT disconnected")
        client = null
        activeDriverId = null
    }

    private fun subscribe(context: Context, mqttClient: MqttAsyncClient, driverId: String) {
        val topics = arrayOf("drivers/$driverId/events", "drivers/broadcast/events")
        val qos = intArrayOf(1, 1)
        mqttClient.subscribe(topics, qos, null, object : IMqttActionListener {
            override fun onSuccess(asyncActionToken: org.eclipse.paho.client.mqttv3.IMqttToken?) {
                android.util.Log.i("DriverMqttManager", "MQTT subscribed: ${topics.joinToString()}")
            }

            override fun onFailure(asyncActionToken: org.eclipse.paho.client.mqttv3.IMqttToken?, exception: Throwable?) {
                android.util.Log.e("DriverMqttManager", "MQTT subscribe failed: ${exception?.message ?: "unknown"}")
            }
        })
    }

    private fun handleMessage(context: Context, topic: String, message: MqttMessage?) {
        if (message == null) return
        val payloadText = runCatching { String(message.payload, StandardCharsets.UTF_8) }.getOrDefault("")
        val payload = runCatching { JSONObject(payloadText) }.getOrElse { JSONObject() }
        val soundKey = payload.optString("soundKey").takeIf { it.isNotBlank() }
        val type = payload.optString("type").ifBlank { "mqtt_event" }
        val title = payload.optString("title").ifBlank { "配送通知" }
        val body = payload.optString("body").ifBlank { "你有新的配送更新。" }
        val shouldPlaySound = payload.optString("playSound") == "true" ||
            soundKey == DriverNotifications.SOUND_NEW_ORDER ||
            soundKey == DriverNotifications.SOUND_URGENT_ORDER ||
            soundKey == DriverNotifications.SOUND_ORDER_CANCELLED ||
            soundKey == DriverNotifications.SOUND_CUSTOMER_HURRY

        android.util.Log.i("DriverMqttManager", "MQTT topic=$topic, type=$type, soundKey=${soundKey ?: "null"}, playSound=$shouldPlaySound")

        if (type != "order_invalidated") {
            DriverNotifications.showDispatchAlert(context, title, body, soundKey)
            if (shouldPlaySound) {
                DriverSoundEffects.playBySoundKey(context, soundKey)
            }
        }

        context.sendBroadcast(Intent(ACTION_ORDER_UPDATED))
    }
}
