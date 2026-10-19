package su.huevo.themes

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import java.io.FileNotFoundException
import java.util.function.BiFunction

/**
 * Serves https://huevo.su/__huevo_themes__/<path> from the APK assets
 * (assets/huevo-themes/<path>), so the bundled huEVO Themes extension runs on
 * the site's own origin: same storage for the content script and the editor
 * iframe, and no CSP or mixed-content issues.
 */
object AssetServer {
  const val PREFIX = "/__huevo_themes__/"
  private const val ASSET_DIR = "huevo-themes/"

  private val MIME = mapOf(
    "js" to "text/javascript", "css" to "text/css", "html" to "text/html", "json" to "application/json",
    "png" to "image/png", "jpg" to "image/jpeg", "gif" to "image/gif", "svg" to "image/svg+xml",
    "mp4" to "video/mp4", "webm" to "video/webm", "mp3" to "audio/mpeg", "wav" to "audio/wav",
  )

  fun install(context: Context) {
    val app = context.applicationContext
    val hook = BiFunction<WebView, WebResourceRequest, WebResourceResponse?> { _, request -> serve(app, request) }
    runCatching {
      Class.forName("com.reactnativecommunity.webview.RNCWebViewClient")
        .getField("requestInterceptor")
        .set(null, hook)
    }
  }

  private fun serve(context: Context, request: WebResourceRequest): WebResourceResponse? {
    val url: Uri = request.url
    val host = url.host ?: return null
    if (host != "huevo.su" && !host.endsWith(".huevo.su")) return null
    val path = url.path ?: return null
    if (!path.startsWith(PREFIX)) return null
    val rel = Uri.decode(path.removePrefix(PREFIX)).trimStart('/')
    if (rel.isEmpty() || rel.contains("..")) return notFound()
    val asset = ASSET_DIR + rel
    val mime = MIME[rel.substringAfterLast('.', "").lowercase()] ?: "application/octet-stream"
    val headers = mutableMapOf("Cache-Control" to "no-cache", "Accept-Ranges" to "bytes")
    return try {
      val range = request.requestHeaders.entries.firstOrNull { it.key.equals("Range", true) }?.value
      if (range != null) ranged(context, asset, mime, range, headers)?.let { return it }
      val stream = context.assets.open(asset)
      WebResourceResponse(mime, "UTF-8", 200, "OK", headers, stream)
    } catch (e: FileNotFoundException) {
      notFound()
    }
  }

  /** 206 response for media seeking; only possible for uncompressed assets (openFd). */
  private fun ranged(
    context: Context, asset: String, mime: String, range: String, headers: MutableMap<String, String>,
  ): WebResourceResponse? {
    val fd = runCatching { context.assets.openFd(asset) }.getOrNull() ?: return null
    val total = fd.length
    val m = Regex("bytes=(\\d*)-(\\d*)").find(range) ?: return null
    val start = m.groupValues[1].toLongOrNull() ?: 0L
    val end = (m.groupValues[2].toLongOrNull() ?: (total - 1)).coerceAtMost(total - 1)
    if (start > end) return null
    val stream = fd.createInputStream()
    stream.skip(start)
    headers["Content-Range"] = "bytes $start-$end/$total"
    headers["Content-Length"] = (end - start + 1).toString()
    return WebResourceResponse(mime, null, 206, "Partial Content", headers, LimitedStream(stream, end - start + 1))
  }

  private fun notFound() =
    WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", emptyMap(), "".byteInputStream())

  private class LimitedStream(private val inner: java.io.InputStream, private var left: Long) : java.io.InputStream() {
    override fun read(): Int {
      if (left <= 0) return -1
      val b = inner.read()
      if (b >= 0) left--
      return b
    }

    override fun read(b: ByteArray, off: Int, len: Int): Int {
      if (left <= 0) return -1
      val n = inner.read(b, off, minOf(len.toLong(), left).toInt())
      if (n > 0) left -= n
      return n
    }

    override fun close() = inner.close()
  }
}
