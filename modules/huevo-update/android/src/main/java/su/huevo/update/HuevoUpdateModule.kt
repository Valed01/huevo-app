package su.huevo.update

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HuevoUpdateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HuevoUpdate")

    Events("onShowUpdate", "onProgress")

    /** Daily background check (network only) for releases of the given GitHub repo ("owner/name"). */
    Function("start") { repo: String ->
      val ctx = appContext.reactContext?.applicationContext ?: return@Function null
      Updates.setRepo(ctx, repo)
      UpdateWorker.schedule(ctx)
      null
    }

    /** Release to offer now, or null. GitHub is asked at most once a day unless force. */
    AsyncFunction("check") { force: Boolean, ignoreSnooze: Boolean ->
      val ctx = appContext.reactContext?.applicationContext ?: return@AsyncFunction null
      Updates.available(ctx, force, ignoreSnooze)?.toMap()
    }

    Function("installedVersion") {
      appContext.reactContext?.let { Updates.installedVersion(it) }
    }

    Function("snooze") {
      appContext.reactContext?.let { Updates.snooze(it) }
      null
    }

    Function("skip") { tag: String ->
      appContext.reactContext?.let { Updates.skip(it, tag) }
      null
    }

    /** Downloads the APK (progress via onProgress, -1 if unknown) and opens the system installer. */
    AsyncFunction("install") { url: String, tag: String ->
      val activity = appContext.currentActivity ?: throw IllegalStateException("no activity")
      val file = Installer.download(activity, url, tag) { pct -> sendEvent("onProgress", mapOf("percent" to pct)) }
      activity.runOnUiThread { Installer.install(activity, file) }
      null
    }

    /** Opened from the "update available" notification (consumed on read). */
    Function("takeLaunchRequest") {
      val intent = appContext.currentActivity?.intent ?: return@Function false
      val requested = intent.getBooleanExtra(UpdateWorker.EXTRA_SHOW_UPDATE, false)
      intent.removeExtra(UpdateWorker.EXTRA_SHOW_UPDATE)
      requested
    }

    OnNewIntent { intent: Intent ->
      if (!intent.getBooleanExtra(UpdateWorker.EXTRA_SHOW_UPDATE, false)) return@OnNewIntent
      intent.removeExtra(UpdateWorker.EXTRA_SHOW_UPDATE)
      sendEvent("onShowUpdate", emptyMap<String, Any>())
    }
  }
}
