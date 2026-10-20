package su.huevo.notify

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.WebSettings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HuevoNotifyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HuevoNotify")

    Events("onOpenPath")

    /**
     * Starts the background check (every ~15 min, only with network). Safe to call on every launch.
     * uaSuffix is the WebView's applicationNameForUserAgent, so requests look like the app's WebView.
     */
    Function("start") { uaSuffix: String ->
      val ctx = appContext.reactContext?.applicationContext ?: return@Function null
      val ua = runCatching { WebSettings.getDefaultUserAgent(ctx) }.getOrDefault("") + " " + uaSuffix
      NotifyScheduler.start(ctx, ua.trim())
      null
    }

    /** Whether the first-launch permission request (notifications, mic, camera) was shown. */
    Function("wasPermissionAsked") {
      val ctx = appContext.reactContext ?: return@Function true
      NotifyWorker.prefs(ctx).getBoolean("permissionsAsked", false)
    }

    /** Android's notification settings for the app (channels, sound, on/off). */
    Function("openSettings") {
      val activity = appContext.currentActivity ?: return@Function null
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + activity.packageName))
      }
      activity.startActivity(intent)
      null
    }

    Function("setPermissionAsked") {
      appContext.reactContext?.let { NotifyWorker.prefs(it).edit().putBoolean("permissionsAsked", true).apply() }
      null
    }

    Function("stop") {
      appContext.reactContext?.let { NotifyScheduler.stop(it.applicationContext) }
      null
    }

    /** Site path (and account) from the notification that launched the app, once. */
    Function("takeLaunch") {
      val intent = appContext.currentActivity?.intent ?: return@Function null
      val path = intent.getStringExtra(NotifyWorker.EXTRA_PATH) ?: return@Function null
      val account = intent.getStringExtra(NotifyWorker.EXTRA_ACCOUNT)
      intent.removeExtra(NotifyWorker.EXTRA_PATH)
      intent.removeExtra(NotifyWorker.EXTRA_ACCOUNT)
      mapOf("path" to path, "account" to account)
    }

    OnNewIntent { intent: Intent ->
      val path = intent.getStringExtra(NotifyWorker.EXTRA_PATH) ?: return@OnNewIntent
      val account = intent.getStringExtra(NotifyWorker.EXTRA_ACCOUNT)
      intent.removeExtra(NotifyWorker.EXTRA_PATH)
      intent.removeExtra(NotifyWorker.EXTRA_ACCOUNT)
      sendEvent("onOpenPath", mapOf("path" to path, "account" to account))
    }

    // In the app the site shows its own toasts: no system notifications for the open account.
    OnActivityEntersForeground {
      NotifyWorker.appVisible = true
      appContext.reactContext?.let { NotifyWorker.clearShown(it.applicationContext) }
    }

    OnActivityEntersBackground {
      NotifyWorker.appVisible = false
      // Everything up to now was seen in the app: notify only about what comes after.
      appContext.reactContext?.let { NotifyScheduler.markSeen(it.applicationContext) }
    }
  }
}
