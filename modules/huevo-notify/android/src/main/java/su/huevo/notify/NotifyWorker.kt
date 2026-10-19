package su.huevo.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.webkit.CookieManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * One check of huEVO's /api/unread_counts (the same endpoint the site polls),
 * using the WebView's session cookies. New messages and notifications since
 * the last check become system notifications.
 */
class NotifyWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  companion object {
    const val EXTRA_PATH = "su.huevo.notify.PATH"
    const val INPUT_SEEN_ONLY = "seenOnly"
    const val PREF_UA = "ua"

    private const val SITE = "https://huevo.su"
    private const val CHANNEL_MESSAGES = "huevo_messages"
    private const val CHANNEL_ACTIVITY = "huevo_activity"
    private const val MAX_PER_RUN = 5

    /** Kind of event → id mark the site uses for it (query parameter and stored baseline). */
    private val MARKS = linkedMapOf("message" to "m", "group" to "g", "notify" to "n", "secure" to "s")

    @Volatile var appVisible = false

    fun prefs(context: Context): SharedPreferences =
      context.getSharedPreferences("huevo_notify", Context.MODE_PRIVATE)

    /** Removes our notifications (not the music player) when the app is opened. */
    fun clearShown(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val nm = context.getSystemService(NotificationManager::class.java) ?: return
      nm.activeNotifications
        .filter { it.notification.channelId == CHANNEL_MESSAGES || it.notification.channelId == CHANNEL_ACTIVITY }
        .forEach { nm.cancel(it.tag, it.id) }
    }
  }

  override fun doWork(): Result {
    val prefs = prefs(applicationContext)
    val data = fetchCounts(prefs) ?: return Result.success()

    val seenOnly = inputData.getBoolean(INPUT_SEEN_ONLY, false) || appVisible
    val firstRun = !prefs.contains("init")
    val latest = latestIds(data)

    if (!seenOnly && !firstRun) notifyNew(data, prefs)

    // Move the marks forward; never backwards.
    val edit = prefs.edit().putBoolean("init", true)
    MARKS.values.forEach { mark -> edit.putLong(mark, maxOf(prefs.getLong(mark, 0), latest[mark] ?: 0)) }
    edit.apply()
    return Result.success()
  }

  private fun fetchCounts(prefs: SharedPreferences): JSONObject? {
    val cookies = runCatching { CookieManager.getInstance().getCookie(SITE) }.getOrNull()
    if (cookies.isNullOrEmpty()) return null // not logged in in the app (yet)
    val query = MARKS.values.joinToString("&") { "$it=${prefs.getLong(it, 0)}" } + "&r=0"
    return runCatching {
      val conn = URL("$SITE/api/unread_counts?$query").openConnection() as HttpURLConnection
      conn.connectTimeout = 15_000
      conn.readTimeout = 15_000
      conn.setRequestProperty("Cookie", cookies)
      conn.setRequestProperty("Accept", "application/json")
      conn.setRequestProperty("X-Requested-With", "XMLHttpRequest")
      conn.setRequestProperty("Referer", "$SITE/")
      prefs.getString(PREF_UA, null)?.let { conn.setRequestProperty("User-Agent", it) }
      try {
        // 401/418 (session or browser check expired): wait until the app is opened again.
        if (conn.responseCode != 200 || conn.contentType?.contains("json") != true) return null
        JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
      } finally {
        conn.disconnect()
      }
    }.getOrNull()?.takeIf { !it.has("error") }
  }

  private fun latestIds(data: JSONObject): Map<String, Long> = mapOf(
    "m" to (data.optJSONObject("last_message")?.optLong("id") ?: 0),
    "g" to (data.optJSONObject("last_group_message")?.optLong("id") ?: 0),
    "n" to data.optLong("last_notification_id"),
    "s" to (data.optJSONObject("last_secure_message")?.optLong("id") ?: 0),
  )

  private fun notifyNew(data: JSONObject, prefs: SharedPreferences) {
    val nm = NotificationManagerCompat.from(applicationContext)
    if (!nm.areNotificationsEnabled()) return
    ensureChannels()
    val events = data.optJSONArray("events") ?: return
    val fresh = (0 until events.length())
      .mapNotNull { events.optJSONObject(it) }
      .filter { ev ->
        val mark = MARKS[ev.optString("kind")] ?: return@filter false
        ev.optLong("id") > prefs.getLong(mark, 0)
      }
      .sortedBy { it.optLong("id") }
      .takeLast(MAX_PER_RUN)
    fresh.forEach { show(nm, it) }
  }

  private fun show(nm: NotificationManagerCompat, ev: JSONObject) {
    val kind = ev.optString("kind")
    val isMessage = kind != "notify"
    val head = when (kind) {
      "message" -> "Новое сообщение"
      "group" -> "Сообщение в беседе"
      "secure" -> "Защищённое сообщение"
      else -> "Уведомление"
    }
    val name = ev.optString("name").ifBlank { head }
    // Secure (end-to-end) messages: the text is never shown outside the chat.
    val text = if (kind == "secure") head else ev.optString("text").ifBlank { head }
    val where = ev.optString("where").takeIf { it.isNotBlank() }
    val path = ev.optString("link").takeIf { it.startsWith("/") } ?: if (isMessage) "/messages" else "/notifications"
    val id = "$kind:${ev.optLong("id")}".hashCode()

    val launch = applicationContext.packageManager.getLaunchIntentForPackage(applicationContext.packageName)
      ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      ?.putExtra(EXTRA_PATH, path) ?: return
    val open = PendingIntent.getActivity(
      applicationContext, id, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = NotificationCompat.Builder(applicationContext, if (isMessage) CHANNEL_MESSAGES else CHANNEL_ACTIVITY)
      .setSmallIcon(R.drawable.huevo_notify_small)
      .setColor(0xFFB01E1E.toInt())
      .setContentTitle(name)
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setContentIntent(open)
      .setAutoCancel(true)
      .setCategory(if (isMessage) NotificationCompat.CATEGORY_MESSAGE else NotificationCompat.CATEGORY_SOCIAL)
      .setGroup(if (isMessage) CHANNEL_MESSAGES else CHANNEL_ACTIVITY)
      .setWhen(System.currentTimeMillis())
    where?.let { builder.setSubText(it) }
    avatar(ev.optString("avatar"))?.let { builder.setLargeIcon(it) }

    runCatching { nm.notify(id, builder.build()) } // SecurityException if permission was revoked meanwhile
  }

  private fun avatar(src: String): Bitmap? {
    if (src.isBlank()) return null
    val url = if (src.startsWith("http")) src else SITE + (if (src.startsWith("/")) src else "/$src")
    if (url.endsWith(".svg")) return null
    return runCatching {
      val conn = URL(url).openConnection() as HttpURLConnection
      conn.connectTimeout = 10_000
      conn.readTimeout = 10_000
      CookieManager.getInstance().getCookie(SITE)?.let { conn.setRequestProperty("Cookie", it) }
      try {
        conn.inputStream.use { BitmapFactory.decodeStream(it) }
      } finally {
        conn.disconnect()
      }
    }.getOrNull()
  }

  private fun ensureChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = applicationContext.getSystemService(NotificationManager::class.java) ?: return
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_MESSAGES, "Сообщения", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Личные сообщения и беседы"
      },
    )
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_ACTIVITY, "Уведомления", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Лайки, комментарии, заявки в друзья и другое"
      },
    )
  }
}
