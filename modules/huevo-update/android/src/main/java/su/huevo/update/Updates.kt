package su.huevo.update

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class Release(
  val tag: String,
  val version: String,
  val notes: String,
  val apkUrl: String,
  val pageUrl: String,
) {
  fun toMap() = mapOf("tag" to tag, "version" to version, "notes" to notes, "apkUrl" to apkUrl, "pageUrl" to pageUrl)
}

/** Latest GitHub release vs the installed version, plus the user's "later" / "skip" choices. */
object Updates {
  private const val PREF_REPO = "repo"
  private const val PREF_SKIPPED = "skipped"
  private const val PREF_SNOOZE_UNTIL = "snoozeUntil"
  private const val PREF_LAST_CHECK = "lastCheck"
  private const val PREF_CACHED = "cached"
  const val PREF_NOTIFIED = "notified"
  const val DAY_MS = 24L * 60 * 60 * 1000

  fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences("huevo_update", Context.MODE_PRIVATE)

  fun setRepo(context: Context, repo: String) = prefs(context).edit().putString(PREF_REPO, repo).apply()

  fun installedVersion(context: Context): String =
    runCatching { context.packageManager.getPackageInfo(context.packageName, 0).versionName }.getOrNull() ?: "0"

  /**
   * The release to offer, or null. Hits GitHub at most once a day unless [force];
   * respects "skip this version" always and "remind later" unless [ignoreSnooze].
   */
  fun available(context: Context, force: Boolean = false, ignoreSnooze: Boolean = false): Release? {
    val prefs = prefs(context)
    val now = System.currentTimeMillis()
    val release = if (force || now - prefs.getLong(PREF_LAST_CHECK, 0) >= DAY_MS) {
      fetchLatest(prefs)?.also {
        prefs.edit().putLong(PREF_LAST_CHECK, now).putString(PREF_CACHED, toJson(it)).apply()
      }
    } else {
      prefs.getString(PREF_CACHED, null)?.let(::fromJson)
    } ?: return null

    if (!isNewer(release.version, installedVersion(context))) return null
    if (prefs.getString(PREF_SKIPPED, null) == release.tag) return null
    if (!ignoreSnooze && now < prefs.getLong(PREF_SNOOZE_UNTIL, 0)) return null
    return release
  }

  fun snooze(context: Context) =
    prefs(context).edit().putLong(PREF_SNOOZE_UNTIL, System.currentTimeMillis() + DAY_MS).apply()

  fun skip(context: Context, tag: String) = prefs(context).edit().putString(PREF_SKIPPED, tag).apply()

  private fun fetchLatest(prefs: SharedPreferences): Release? {
    val repo = prefs.getString(PREF_REPO, null) ?: return null
    return runCatching {
      val conn = URL("https://api.github.com/repos/$repo/releases/latest").openConnection() as HttpURLConnection
      conn.connectTimeout = 15_000
      conn.readTimeout = 15_000
      conn.setRequestProperty("Accept", "application/vnd.github+json")
      conn.setRequestProperty("User-Agent", "huevo-app-updater")
      try {
        if (conn.responseCode != 200) return null
        val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
        val assets = json.optJSONArray("assets")
        val apk = (0 until (assets?.length() ?: 0))
          .mapNotNull { assets?.optJSONObject(it) }
          .firstOrNull { it.optString("name").endsWith(".apk") }
          ?: return null
        val tag = json.optString("tag_name")
        Release(
          tag = tag,
          version = tag.removePrefix("v"),
          notes = json.optString("body"),
          apkUrl = apk.optString("browser_download_url"),
          pageUrl = json.optString("html_url"),
        )
      } finally {
        conn.disconnect()
      }
    }.getOrNull()
  }

  /** Numeric compare of dotted versions: 0.10.0 > 0.9.3. */
  fun isNewer(remote: String, local: String): Boolean {
    val r = remote.split('.', '-').map { it.toIntOrNull() ?: 0 }
    val l = local.split('.', '-').map { it.toIntOrNull() ?: 0 }
    for (i in 0 until maxOf(r.size, l.size)) {
      val a = r.getOrElse(i) { 0 }
      val b = l.getOrElse(i) { 0 }
      if (a != b) return a > b
    }
    return false
  }

  private fun toJson(r: Release) = JSONObject(r.toMap()).toString()

  private fun fromJson(s: String): Release? = runCatching {
    val j = JSONObject(s)
    Release(j.getString("tag"), j.getString("version"), j.optString("notes"), j.getString("apkUrl"), j.optString("pageUrl"))
  }.getOrNull()
}
