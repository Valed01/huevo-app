package su.huevo.notify

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit

/**
 * Battery-friendly polling: WorkManager's minimum period (15 min), only with a
 * network connection; the system batches it with other jobs and defers it in Doze.
 * One small GET per run, no foreground service, no open sockets.
 */
object NotifyScheduler {
  private const val PERIODIC = "huevo-notify-periodic"
  private const val SEEN = "huevo-notify-seen"

  private val network = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

  fun start(context: Context, userAgent: String) {
    NotifyWorker.prefs(context).edit().putString(NotifyWorker.PREF_UA, userAgent).apply()
    val request = PeriodicWorkRequestBuilder<NotifyWorker>(15, TimeUnit.MINUTES)
      .setConstraints(network)
      .build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.UPDATE, request)
  }

  fun stop(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(PERIODIC)
  }

  /** One-off run that only moves the "already seen" marks forward. */
  fun markSeen(context: Context) {
    val request = OneTimeWorkRequestBuilder<NotifyWorker>()
      .setConstraints(network)
      .setInputData(workDataOf(NotifyWorker.INPUT_SEEN_ONLY to true))
      .build()
    WorkManager.getInstance(context).enqueueUniqueWork(SEEN, ExistingWorkPolicy.REPLACE, request)
  }
}
