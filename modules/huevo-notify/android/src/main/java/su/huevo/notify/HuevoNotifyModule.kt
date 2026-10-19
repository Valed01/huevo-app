package su.huevo.notify

import android.content.Intent
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

    /** Whether we already asked for the notification permission (ask once, never nag). */
    Function("wasPermissionAsked") {
      val ctx = appContext.reactContext ?: return@Function true
      NotifyWorker.prefs(ctx).getBoolean("asked", false)
    }

    Function("setPermissionAsked") {
      appContext.reactContext?.let { NotifyWorker.prefs(it).edit().putBoolean("asked", true).apply() }
      null
    }

    Function("stop") {
      appContext.reactContext?.let { NotifyScheduler.stop(it.applicationContext) }
      null
    }

    /** Site path from the notification that launched the app, once. */
    Function("takeLaunchPath") {
      val intent = appContext.currentActivity?.intent ?: return@Function null
      val path = intent.getStringExtra(NotifyWorker.EXTRA_PATH)
      intent.removeExtra(NotifyWorker.EXTRA_PATH)
      path
    }

    OnNewIntent { intent: Intent ->
      val path = intent.getStringExtra(NotifyWorker.EXTRA_PATH) ?: return@OnNewIntent
      intent.removeExtra(NotifyWorker.EXTRA_PATH)
      sendEvent("onOpenPath", mapOf("path" to path))
    }

    // In the app the site shows its own toasts: no system notifications while it's open.
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
