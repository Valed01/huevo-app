package su.huevo.themes

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.widget.Toast
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class HuevoThemesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HuevoThemes")

    OnCreate {
      appContext.reactContext?.let { AssetServer.install(it) }
    }

    /** Saves an exported file (e.g. a .hvthm theme) to Downloads. Returns where it went. */
    AsyncFunction("saveToDownloads") { name: String, base64: String, mime: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("no context")
      val bytes = Base64.decode(base64, Base64.DEFAULT)
      val safe = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").ifEmpty { "file" }
      val location = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val values = ContentValues().apply {
          put(MediaStore.Downloads.DISPLAY_NAME, safe)
          put(MediaStore.Downloads.MIME_TYPE, mime)
          put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/huEVO")
        }
        val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
          ?: throw IllegalStateException("MediaStore insert failed")
        context.contentResolver.openOutputStream(uri).use { it!!.write(bytes) }
        "Загрузки/huEVO/$safe"
      } else {
        @Suppress("DEPRECATION")
        val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "huEVO")
        dir.mkdirs()
        File(dir, safe).writeBytes(bytes)
        "Загрузки/huEVO/$safe"
      }
      android.os.Handler(android.os.Looper.getMainLooper()).post {
        Toast.makeText(context, "Сохранено: $location", Toast.LENGTH_LONG).show()
      }
      location
    }
  }
}
