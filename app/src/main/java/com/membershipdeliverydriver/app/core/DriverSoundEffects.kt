package com.membershipdeliverydriver.app.core

import android.content.Context
import android.media.MediaPlayer
import com.membershipdeliverydriver.app.R

object DriverSoundEffects {
    fun playOrderCompleted(context: Context) {
        play(context, R.raw.sound_order_completed)
    }

    private fun play(context: Context, resId: Int) {
        val mediaPlayer = MediaPlayer.create(context.applicationContext, resId) ?: return
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
