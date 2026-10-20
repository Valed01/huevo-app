package su.huevo.accounts

import android.content.Context
import android.content.SharedPreferences
import android.webkit.WebView
import androidx.webkit.Profile
import androidx.webkit.ProfileStore
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject

/**
 * huEVO accounts added in the app. Each one lives in its own WebView profile (cookies,
 * localStorage, IndexedDB, cache), so sessions and the site's local data (secure chat
 * keys, drafts) never mix. The first account is the default profile, so existing
 * installs keep their login.
 *
 * Stored in SharedPreferences "huevo_accounts", also read by the notification worker
 * (modules/huevo-notify): "list" = JSON array of {id, profile, name, user, avatar,
 * loggedIn}, "current" = id of the account shown in the app.
 */
object Accounts {
  const val MAIN = "main"
  private const val PREFS = "huevo_accounts"
  private const val LIST = "list"
  private const val CURRENT = "current"
  /** Profiles of removed accounts, deleted once no WebView uses them. */
  private const val PENDING_DELETE = "pendingDelete"

  fun prefs(context: Context): SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** Separate profiles need Android System WebView with multi-profile support. */
  fun isSupported(): Boolean = runCatching { WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE) }
    .getOrDefault(false)

  fun list(context: Context): JSONArray {
    val stored = runCatching { JSONArray(prefs(context).getString(LIST, null) ?: "") }.getOrNull()
    if (stored != null && stored.length() > 0) return stored
    return JSONArray().put(JSONObject().put("id", MAIN).put("profile", Profile.DEFAULT_PROFILE_NAME))
  }

  private fun save(context: Context, list: JSONArray, current: String) {
    prefs(context).edit().putString(LIST, list.toString()).putString(CURRENT, current).apply()
  }

  private fun find(list: JSONArray, id: String): JSONObject? =
    (0 until list.length()).map { list.getJSONObject(it) }.firstOrNull { it.optString("id") == id }

  fun current(context: Context): String {
    val list = list(context)
    val id = prefs(context).getString(CURRENT, null)
    return if (id != null && find(list, id) != null) id else list.getJSONObject(0).optString("id")
  }

  private fun profileOf(context: Context, id: String): String =
    find(list(context), id)?.optString("profile")?.ifEmpty { null } ?: Profile.DEFAULT_PROFILE_NAME

  /** A new, empty account (own profile) that becomes the current one. Returns its id. */
  fun add(context: Context): String {
    val list = list(context)
    val id = "a" + System.currentTimeMillis().toString(36)
    list.put(JSONObject().put("id", id).put("profile", "huevo_$id"))
    save(context, list, id)
    return id
  }

  fun setCurrent(context: Context, id: String) {
    val list = list(context)
    if (find(list, id) != null) save(context, list, id)
  }

  /** Who is signed in to the account (reported by the page). */
  fun update(context: Context, id: String, info: String) {
    val data = runCatching { JSONObject(info) }.getOrNull() ?: return
    val list = list(context)
    val account = find(list, id) ?: return
    for (key in listOf("name", "user", "avatar")) if (data.has(key)) account.put(key, data.optString(key))
    if (data.has("loggedIn")) account.put("loggedIn", data.optBoolean("loggedIn"))
    save(context, list, current(context))
  }

  /**
   * Removes the account from the app and wipes its data on the device (the site session
   * included). Must run on the main thread. The current account can't be removed: switch first.
   */
  fun remove(context: Context, id: String) {
    val list = list(context)
    if (list.length() < 2 || id == current(context)) return
    val profile = profileOf(context, id)
    val rest = JSONArray()
    (0 until list.length()).map { list.getJSONObject(it) }.filter { it.optString("id") != id }.forEach { rest.put(it) }
    save(context, rest, current(context))
    if (!isSupported()) return
    if (profile == Profile.DEFAULT_PROFILE_NAME) {
      // The default profile can't be deleted: empty it instead.
      runCatching {
        val p = ProfileStore.getInstance().getProfile(profile) ?: return
        p.cookieManager.removeAllCookies(null)
        p.cookieManager.flush()
        p.webStorage.deleteAllData()
      }
    } else {
      val pending = prefs(context).getStringSet(PENDING_DELETE, emptySet())!!.toMutableSet()
      pending += profile
      prefs(context).edit().putStringSet(PENDING_DELETE, pending).apply()
      deletePending(context)
    }
  }

  /** Deletes removed accounts' profiles that are no longer in use. Main thread. */
  fun deletePending(context: Context) {
    val pending = prefs(context).getStringSet(PENDING_DELETE, emptySet())!!
    if (pending.isEmpty() || !isSupported()) return
    val left = pending.filterTo(mutableSetOf()) { name ->
      try {
        ProfileStore.getInstance().deleteProfile(name)
        false
      } catch (e: IllegalStateException) {
        true // still used by a WebView that's being destroyed: next time
      } catch (e: IllegalArgumentException) {
        false // already gone
      }
    }
    prefs(context).edit().putStringSet(PENDING_DELETE, left).apply()
  }

  /** Puts a new WebView into the current account's profile. Main thread, before the WebView is used. */
  fun applyProfile(context: Context, webView: WebView) {
    if (!isSupported()) return
    val profile = profileOf(context, current(context))
    if (profile == Profile.DEFAULT_PROFILE_NAME) return
    ProfileStore.getInstance().getOrCreateProfile(profile)
    WebViewCompat.setProfile(webView, profile)
  }
}
