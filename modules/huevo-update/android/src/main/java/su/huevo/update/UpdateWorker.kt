package su.huevo.update

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/** Once a day: is there a newer release? Then one notification per release. */
class UpdateWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  companion object {
    const val EXTRA_SHOW_UPDATE = "su.huevo.update.SHOW"
    private const val WORK = "huevo-update-daily"
    private const val CHANNEL = "huevo_updates"
    private const val NOTIFICATION_ID = 2201

    fun schedule(context: Context) {
      val request = PeriodicWorkRequestBuilder<UpdateWorker>(1, TimeUnit.DAYS)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build()
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, request)
    }
  }

  override fun doWork(): Result {
    val release = Updates.available(applicationContext, force = true) ?: return Result.success()
    val prefs = Updates.prefs(applicationContext)
    if (prefs.getString(Updates.PREF_NOTIFIED, null) == release.tag) return Result.success()

    val nm = NotificationManagerCompat.from(applicationContext)
    if (!nm.areNotificationsEnabled()) return Result.success()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      applicationContext.getSystemService(NotificationManager::class.java)?.createNotificationChannel(
        NotificationChannel(CHANNEL, "Обновления", NotificationManager.IMPORTANCE_DEFAULT),
      )
    }
    val launch = applicationContext.packageManager.getLaunchIntentForPackage(applicationContext.packageName)
      ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      ?.putExtra(EXTRA_SHOW_UPDATE, true) ?: return Result.success()
    val open = PendingIntent.getActivity(
      applicationContext, NOTIFICATION_ID, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(applicationContext, CHANNEL)
      .setSmallIcon(android.R.drawable.stat_sys_download_done)
      .setColor(0xFFB01E1E.toInt())
      .setContentTitle("Доступно обновление huEVO ${release.version}")
      .setContentText("Нажмите, чтобы посмотреть, что нового")
      .setContentIntent(open)
      .setAutoCancel(true)
      .build()
    runCatching { nm.notify(NOTIFICATION_ID, notification) }
    prefs.edit().putString(Updates.PREF_NOTIFIED, release.tag).apply()
    return Result.success()
  }
}
