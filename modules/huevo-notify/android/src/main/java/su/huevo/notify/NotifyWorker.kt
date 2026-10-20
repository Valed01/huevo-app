package su.huevo.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.webkit.ProfileStore
import androidx.webkit.WebViewFeature
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * One check of huEVO's /api/unread_counts (the same endpoint the site polls),
 * using the WebView's session cookies, for every account added in the app (each
 * has its own WebView profile, see modules/huevo-accounts). New messages and
 * notifications since the last check become system notifications.
 */
class NotifyWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  companion object {
    const val EXTRA_PATH = "su.huevo.notify.PATH"
    const val EXTRA_ACCOUNT = "su.huevo.notify.ACCOUNT"
    const val INPUT_SEEN_ONLY = "seenOnly"
    /** With seenOnly: only this account (the one that was open in the app). */
    const val INPUT_ACCOUNT = "account"
    const val INPUT_TICK = "tick"
    const val PREF_UA = "ua"

    private const val SITE = "https://huevo.su"
    private const val CHANNEL_MESSAGES = "huevo_messages"
    private const val CHANNEL_ACTIVITY = "huevo_activity"
    private const val MAX_PER_RUN = 5
    private const val MAIN_ACCOUNT = "main"
    private const val DEFAULT_PROFILE = "Default"

    /** Kind of event → id mark the site uses for it (query parameter and stored baseline). */
    private val MARKS = linkedMapOf("message" to "m", "group" to "g", "notify" to "n", "secure" to "s")

    @Volatile var appVisible = false

    fun prefs(context: Context): SharedPreferences =
      context.getSharedPreferences("huevo_notify", Context.MODE_PRIVATE)

    /** An account added in the app: its WebView profile and how it's signed. */
    data class Account(val id: String, val profile: String, val name: String)

    /** Accounts from modules/huevo-accounts (SharedPreferences "huevo_accounts"). */
    fun accounts(context: Context): List<Account> {
      val prefs = context.getSharedPreferences("huevo_accounts", Context.MODE_PRIVATE)
      val list = runCatching { JSONArray(prefs.getString("list", null) ?: "") }.getOrNull()
      val out = (0 until (list?.length() ?: 0)).mapNotNull { list?.optJSONObject(it) }.map {
        val user = it.optString("user")
        Account(
          it.optString("id"),
          it.optString("profile").ifEmpty { DEFAULT_PROFILE },
          it.optString("name").ifBlank { if (user.isNotBlank()) "@$user" else "" },
        )
      }
      return out.ifEmpty { listOf(Account(MAIN_ACCOUNT, DEFAULT_PROFILE, "")) }
    }

    /** The account open in the app. */
    fun currentAccount(context: Context): String {
      val list = accounts(context)
      val id = context.getSharedPreferences("huevo_accounts", Context.MODE_PRIVATE).getString("current", null)
      return list.firstOrNull { it.id == id }?.id ?: list.first().id
    }

    /** Removes the current account's notifications (not the music player) when the app is opened. */
    fun clearShown(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val nm = context.getSystemService(NotificationManager::class.java) ?: return
      val current = currentAccount(context)
      nm.activeNotifications
        .filter { it.notification.channelId == CHANNEL_MESSAGES || it.notification.channelId == CHANNEL_ACTIVITY }
        .filter { (it.tag ?: MAIN_ACCOUNT) == current }
        .forEach { nm.cancel(it.tag, it.id) }
    }
  }

  /** Stored "already seen" marks are per account; the first account keeps the original keys. */
  private fun key(account: Account, mark: String) = if (account.id == MAIN_ACCOUNT) mark else "${account.id}:$mark"

  override fun doWork(): Result {
    // The 5-minute chain schedules its next run first, so a failure below can't break it.
    if (inputData.getBoolean(INPUT_TICK, false)) NotifyScheduler.tick(applicationContext)
    val prefs = prefs(applicationContext)
    val accounts = accounts(applicationContext)
    val current = currentAccount(applicationContext)
    val seenOnlyRun = inputData.getBoolean(INPUT_SEEN_ONLY, false)
    val only = inputData.getString(INPUT_ACCOUNT)
    val cookies = cookies(accounts)

    for (account in accounts) {
      if (only != null && account.id != only) continue
      val cookie = cookies[account.id]
      if (cookie.isNullOrEmpty()) continue // not logged in in the app (yet)
      val data = fetchCounts(prefs, account, cookie) ?: continue

      // While the app is open, the site shows its own toasts for the account on screen.
      val seenOnly = seenOnlyRun || (appVisible && account.id == current)
      val firstRun = !prefs.contains(key(account, "init"))
      val latest = latestIds(data)

      if (!seenOnly && !firstRun) notifyNew(data, prefs, account, accounts.size > 1, cookie)

      // Move the marks forward; never backwards.
      val edit = prefs.edit().putBoolean(key(account, "init"), true)
      MARKS.values.forEach { mark ->
        edit.putLong(key(account, mark), maxOf(prefs.getLong(key(account, mark), 0), latest[mark] ?: 0))
      }
      edit.apply()
    }
    return Result.success()
  }

  /** Session cookies of each account's WebView profile (profiles are only reachable on the main thread). */
  private fun cookies(accounts: List<Account>): Map<String, String?> {
    val read = {
      accounts.associate { account ->
        account.id to runCatching {
          if (account.profile == DEFAULT_PROFILE) {
            CookieManager.getInstance().getCookie(SITE)
          } else if (WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) {
            ProfileStore.getInstance().getProfile(account.profile)?.cookieManager?.getCookie(SITE)
          } else {
            null
          }
        }.getOrNull()
      }
    }
    if (accounts.all { it.profile == DEFAULT_PROFILE }) return read()
    val result = AtomicReference<Map<String, String?>>(emptyMap())
    val done = CountDownLatch(1)
    Handler(Looper.getMainLooper()).post {
      try {
        result.set(read())
      } finally {
        done.countDown()
      }
    }
    done.await(10, TimeUnit.SECONDS)
    return result.get()
  }

  private fun fetchCounts(prefs: SharedPreferences, account: Account, cookies: String): JSONObject? {
    val query = MARKS.values.joinToString("&") { "$it=${prefs.getLong(key(account, it), 0)}" } + "&r=0"
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

  private fun notifyNew(data: JSONObject, prefs: SharedPreferences, account: Account, several: Boolean, cookies: String) {
    val nm = NotificationManagerCompat.from(applicationContext)
    if (!nm.areNotificationsEnabled()) return
    ensureChannels()
    // The site attaches details ("events") only to very recent items, so a check every
    // ~15 min usually gets just the counters; then a generic notification is built from them.
    val events = data.optJSONArray("events")
    val fresh = (0 until (events?.length() ?: 0))
      .mapNotNull { events?.optJSONObject(it) }
      .filter { ev ->
        val mark = MARKS[ev.optString("kind")] ?: return@filter false
        ev.optLong("id") > prefs.getLong(key(account, mark), 0)
      }
      .sortedBy { it.optLong("id") }
      .takeLast(MAX_PER_RUN)
    fresh.forEach { show(nm, it, account, several, cookies) }

    val covered = fresh.map { it.optString("kind") }.toSet()
    fallbackEvents(data, prefs, account).filter { it.optString("kind") !in covered }
      .forEach { show(nm, it, account, several, cookies) }
  }

  /** Synthetic events from the counters when the site sent no details. */
  private fun fallbackEvents(data: JSONObject, prefs: SharedPreferences, account: Account): List<JSONObject> {
    val out = mutableListOf<JSONObject>()
    val unreadMessages = data.optInt("messages")
    data.optJSONObject("last_message")?.let { last ->
      val id = last.optLong("id")
      if (id > prefs.getLong(key(account, "m"), 0)) {
        val sender = last.optString("sender")
        out += JSONObject()
          .put("kind", "message").put("id", id)
          .put("name", sender.ifBlank { "Новое сообщение" })
          .put("text", if (unreadMessages > 1) "Непрочитанных сообщений: $unreadMessages" else "Новое сообщение")
          .put("link", if (sender.isNotBlank()) "/messages/" + Uri.encode(sender) else "/messages")
      }
    }
    data.optJSONObject("last_group_message")?.let { last ->
      val id = last.optLong("id")
      if (id > prefs.getLong(key(account, "g"), 0)) {
        val chat = last.optLong("chat_id")
        out += JSONObject()
          .put("kind", "group").put("id", id)
          .put("name", "Сообщение в беседе").put("text", "Новое сообщение в беседе")
          .put("link", if (chat > 0) "/chats/$chat" else "/messages")
      }
    }
    val notifId = data.optLong("last_notification_id")
    if (notifId > prefs.getLong(key(account, "n"), 0)) {
      val unread = data.optInt("notifications")
      out += JSONObject()
        .put("kind", "notify").put("id", notifId)
        .put("name", "Уведомления")
        .put("text", if (unread > 1) "Новых уведомлений: $unread" else "Новое уведомление")
        .put("link", "/notifications")
    }
    return out
  }

  private fun show(nm: NotificationManagerCompat, ev: JSONObject, account: Account, several: Boolean, cookies: String) {
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
    // The first account keeps the original ids (and no tag), so nothing changes with one account.
    val id = (if (account.id == MAIN_ACCOUNT) "$kind:${ev.optLong("id")}" else "${account.id}:$kind:${ev.optLong("id")}")
      .hashCode()
    val tag = if (account.id == MAIN_ACCOUNT) null else account.id

    val launch = applicationContext.packageManager.getLaunchIntentForPackage(applicationContext.packageName)
      ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      ?.putExtra(EXTRA_PATH, path)
      ?.putExtra(EXTRA_ACCOUNT, account.id) ?: return
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
      .setGroup((if (isMessage) CHANNEL_MESSAGES else CHANNEL_ACTIVITY) + (tag?.let { ":$it" } ?: ""))
      .setWhen(System.currentTimeMillis())
    // With several accounts, say which one it's for (like Telegram).
    val forAccount = account.name.takeIf { several && it.isNotBlank() }
    listOfNotNull(where, forAccount).takeIf { it.isNotEmpty() }?.let { builder.setSubText(it.joinToString(" · ")) }
    avatar(ev.optString("avatar"), cookies)?.let { builder.setLargeIcon(it) }

    runCatching { nm.notify(tag, id, builder.build()) } // SecurityException if permission was revoked meanwhile
  }

  private fun avatar(src: String, cookies: String): Bitmap? {
    if (src.isBlank()) return null
    val url = if (src.startsWith("http")) src else SITE + (if (src.startsWith("/")) src else "/$src")
    if (url.endsWith(".svg")) return null
    return runCatching {
      val conn = URL(url).openConnection() as HttpURLConnection
      conn.connectTimeout = 10_000
      conn.readTimeout = 10_000
      conn.setRequestProperty("Cookie", cookies)
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
