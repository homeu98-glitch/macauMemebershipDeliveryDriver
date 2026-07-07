package com.membershipdeliverydriver.app.core

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import com.membershipdeliverydriver.app.R

object DriverSoundEffects {
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
        val mediaPlayer = MediaPlayer.create(context.applicationContext, resId) ?: return
        runCatching {
            mediaPlayer.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
        }
        mediaPlayer.setOnCompletionListener { player ->
            player.release()
        }
        mediaPlayer.setOnErrorListener { player, _, _ ->
            player.release()
            true
        }
        mediaPlayer.start()
    }
}
