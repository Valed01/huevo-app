package su.huevo.update

import android.app.Activity
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Downloads the release APK into the app cache and opens the system installer. */
object Installer {
  fun download(activity: Activity, url: String, tag: String, onProgress: (Int) -> Unit): File {
    val dir = File(activity.cacheDir, "updates").apply { mkdirs() }
    dir.listFiles()?.forEach { it.delete() } // only the latest download is kept
    val file = File(dir, "huevo-$tag.apk")
    var link = url
    // GitHub answers with a redirect to its CDN; follow it by hand (it can cross hosts).
    repeat(5) {
      val conn = URL(link).openConnection() as HttpURLConnection
      conn.instanceFollowRedirects = false
      conn.connectTimeout = 20_000
      conn.readTimeout = 30_000
      conn.setRequestProperty("User-Agent", "huevo-app-updater")
      try {
        when (conn.responseCode) {
          in 300..399 -> { link = conn.getHeaderField("Location") ?: error("redirect without location"); return@repeat }
          200 -> {
            val total = conn.contentLengthLong
            var done = 0L
            var last = -1
            conn.inputStream.use { input ->
              file.outputStream().use { out ->
                val buf = ByteArray(64 * 1024)
                while (true) {
                  val n = input.read(buf)
                  if (n < 0) break
                  out.write(buf, 0, n)
                  done += n
                  val pct = if (total > 0) (done * 100 / total).toInt() else -1
                  if (pct != last) { last = pct; onProgress(pct) }
                }
              }
            }
            return file
          }
          else -> error("HTTP ${conn.responseCode}")
        }
      } finally {
        conn.disconnect()
      }
    }
    error("too many redirects")
  }

  fun install(activity: Activity, file: File) {
    val uri = FileProvider.getUriForFile(activity, activity.packageName + ".huevo_update", file)
    val intent = Intent(Intent.ACTION_VIEW)
      .setDataAndType(uri, "application/vnd.android.package-archive")
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    activity.startActivity(intent)
  }
}
