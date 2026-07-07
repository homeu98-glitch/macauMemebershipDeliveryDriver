package com.membershipdeliverydriver.app.core

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import com.membershipdeliverydriver.app.R

object DriverSoundEffects {
    fun playBySoundKey(context: Context, soundKey: String?) {
        when (soundKey) {
            DriverNotifications.SOUND_NEW_ORDER -> playNewOrder(context)
            DriverNotifications.SOUND_URGENT_ORDER -> playUrgentOrder(context)
            DriverNotifications.SOUND_CUSTOMER_HURRY -> playNewOrder(context)
            DriverNotifications.SOUND_ORDER_COMPLETED -> playOrderCompleted(context)
            DriverNotifications.SOUND_ORDER_CANCELLED -> playOrderCancelled(context)
        }
    }

    fun playNewOrder(context: Context) {
        play(context, R.raw.sound_new_order)
    }

    fun playUrgentOrder(context: Context) {
        play(context, R.raw.sound_urgent_order)
    }

    fun playOrderCancelled(context: Context) {
        play(context, R.raw.sound_order_cancelled)
    }

    fun playOrderOverdue(context: Context) {
        play(context, R.raw.sound_order_overdue)
    }

    fun playOrderCompleted(context: Context) {
        play(context, R.raw.sound_order_completed)
    }

    private fun play(context: Context, resId: Int) {
        val appContext = context.applicationContext
        val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val focusRequest = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(audioAttributes)
                .setAcceptsDelayedFocusGain(false)
                .build()
        } else {
            null
        }

        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioManager?.requestAudioFocus(focusRequest!!)
            } else {
                @Suppress("DEPRECATION")
                audioManager?.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            }
        }

        val mediaPlayer = MediaPlayer.create(appContext, resId) ?: return
        runCatching {
            mediaPlayer.setAudioAttributes(audioAttributes)
            mediaPlayer.setVolume(1.0f, 1.0f)
            mediaPlayer.isLooping = false
        }
        mediaPlayer.setOnCompletionListener { player ->
            player.release()
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    audioManager?.abandonAudioFocusRequest(focusRequest!!)
                } else {
                    @Suppress("DEPRECATION")
                    audioManager?.abandonAudioFocus(null)
                }
            }
        }
        mediaPlayer.setOnErrorListener { player, _, _ ->
            player.release()
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    audioManager?.abandonAudioFocusRequest(focusRequest!!)
                } else {
                    @Suppress("DEPRECATION")
                    audioManager?.abandonAudioFocus(null)
                }
            }
            true
        }
        mediaPlayer.start()
    }
}
