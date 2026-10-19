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
 * Battery-friendly polling: a check every ~5 minutes (plus WorkManager's 15-minute
 * periodic job as a safety net), only with a network connection; the system batches
 * it with other jobs and defers it in Doze. One small GET per run, no foreground
 * service, no open sockets.
 */
object NotifyScheduler {
  private const val PERIODIC = "huevo-notify-periodic"
  private const val SEEN = "huevo-notify-seen"
  private const val TICK = "huevo-notify-tick"

  private val network = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

  fun start(context: Context, userAgent: String) {
    NotifyWorker.prefs(context).edit().putString(NotifyWorker.PREF_UA, userAgent).apply()
    val request = PeriodicWorkRequestBuilder<NotifyWorker>(15, TimeUnit.MINUTES)
      .setConstraints(network)
      .build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.UPDATE, request)
    tick(context, first = true)
  }

  /**
   * The 5-minute check: a chain of one-off jobs, each scheduling the next when it ends
   * (periodic work can't run more often than every 15 min). Network-only, so it's
   * skipped while offline and batched by the system in Doze.
   */
  fun tick(context: Context, first: Boolean = false) {
    val request = OneTimeWorkRequestBuilder<NotifyWorker>()
      .setInitialDelay(5, TimeUnit.MINUTES)
      .setConstraints(network)
      .setInputData(workDataOf(NotifyWorker.INPUT_TICK to true))
      .build()
    // First call keeps an already pending tick; from a running tick, chain the next one after it.
    WorkManager.getInstance(context).enqueueUniqueWork(
      TICK, if (first) ExistingWorkPolicy.KEEP else ExistingWorkPolicy.APPEND_OR_REPLACE, request,
    )
  }

  fun stop(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(PERIODIC)
    WorkManager.getInstance(context).cancelUniqueWork(TICK)
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
