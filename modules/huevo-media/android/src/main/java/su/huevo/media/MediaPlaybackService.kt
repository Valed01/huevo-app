package su.huevo.media

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.media.app.NotificationCompat.MediaStyle

/** Foreground service showing the player in the notification shade and keeping the app alive. */
class MediaPlaybackService : Service() {
  companion object {
    private const val CHANNEL_ID = "huevo_playback"
    private const val NOTIFICATION_ID = 1101
    private const val EXTRA_ACTION = "su.huevo.media.ACTION"

    @Volatile var running = false
      private set
    var instance: MediaPlaybackService? = null
      private set
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    running = true
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "Музыка", NotificationManager.IMPORTANCE_LOW).apply {
        setShowBadge(false)
      }
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    intent?.getStringExtra(EXTRA_ACTION)?.let { MediaController.dispatch(it) }
    val notification = buildNotification()
    if (notification == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    ServiceCompat.startForeground(
      this, NOTIFICATION_ID, notification,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0,
    )
    return START_NOT_STICKY
  }

  fun refresh() {
    val notification = buildNotification() ?: return
    runCatching { NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, notification) }
  }

  override fun onDestroy() {
    running = false
    instance = null
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // App swiped away: the WebView (and its audio) is gone, so drop the player too.
    MediaController.clear(applicationContext)
    super.onTaskRemoved(rootIntent)
  }

  private fun actionIntent(action: String, requestCode: Int): PendingIntent =
    PendingIntent.getService(
      this, requestCode,
      Intent(this, MediaPlaybackService::class.java).putExtra(EXTRA_ACTION, action),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun buildNotification(): android.app.Notification? {
    val state = MediaController.state ?: return null
    val session = MediaController.session ?: return null

    val launch = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.huevo_media_small)
      .setContentTitle(state.title)
      .setContentText(state.artist)
      .setLargeIcon(MediaController.artwork)
      .setContentIntent(launch)
      .setDeleteIntent(actionIntent("pause", 10))
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOnlyAlertOnce(true)
      .setOngoing(state.playing)
      .setSilent(true)

    val compact = mutableListOf<Int>()
    if ("previoustrack" in state.actions) {
      compact += 0
      builder.addAction(android.R.drawable.ic_media_previous, "Назад", actionIntent("previoustrack", 1))
    }
    compact += compact.size
    if (state.playing) {
      builder.addAction(android.R.drawable.ic_media_pause, "Пауза", actionIntent("pause", 2))
    } else {
      builder.addAction(android.R.drawable.ic_media_play, "Играть", actionIntent("play", 3))
    }
    if ("nexttrack" in state.actions) {
      compact += compact.size
      builder.addAction(android.R.drawable.ic_media_next, "Вперёд", actionIntent("nexttrack", 4))
    }

    builder.setStyle(
      MediaStyle()
        .setMediaSession(session.sessionToken)
        .setShowActionsInCompactView(*compact.toIntArray()),
    )
    return builder.build()
  }
}
