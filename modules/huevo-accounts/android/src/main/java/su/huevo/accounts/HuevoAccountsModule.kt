package su.huevo.accounts

import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.function.Consumer

class HuevoAccountsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HuevoAccounts")

    // Every new WebView opens in the current account's profile (react-native-webview's
    // patched hook, see patches/). Switching accounts = a new WebView.
    OnCreate {
      val context = appContext.reactContext?.applicationContext ?: return@OnCreate
      val hook = Consumer<WebView> { webView -> runCatching { Accounts.applyProfile(context, webView) } }
      runCatching {
        Class.forName("com.reactnativecommunity.webview.RNCWebViewClient")
          .getField("onWebViewCreated")
          .set(null, hook)
      }
      Handler(Looper.getMainLooper()).post { runCatching { Accounts.deletePending(context) } }
    }

    Function("isSupported") { Accounts.isSupported() }

    /** JSON array of the accounts. */
    Function("list") {
      val context = appContext.reactContext ?: return@Function "[]"
      Accounts.list(context).toString()
    }

    Function("current") {
      val context = appContext.reactContext ?: return@Function Accounts.MAIN
      Accounts.current(context)
    }

    Function("add") {
      val context = appContext.reactContext ?: throw IllegalStateException("no context")
      Accounts.add(context)
    }

    Function("setCurrent") { id: String ->
      appContext.reactContext?.let { Accounts.setCurrent(it, id) }
      null
    }

    /** info: JSON object {name, user, avatar, loggedIn}. */
    Function("update") { id: String, info: String ->
      appContext.reactContext?.let { Accounts.update(it, id, info) }
      null
    }

    AsyncFunction("remove") { id: String ->
      appContext.reactContext?.let { Accounts.remove(it, id) }
      null
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("deletePending") {
      appContext.reactContext?.let { Accounts.deletePending(it) }
      null
    }.runOnQueue(Queues.MAIN)
  }
}
