package su.huevo.media

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.webkit.CookieManager
import androidx.core.content.ContextCompat
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Holds the MediaSession that mirrors the site's player (navigator.mediaSession
 * in the WebView) and forwards transport commands back to JS.
 */
object MediaController {
  var listener: ((action: String, seekTo: Double?) -> Unit)? = null

  var session: MediaSessionCompat? = null
    private set
  var state: MediaState? = null
    private set
  var artwork: Bitmap? = null
    private set

  private var artworkUrl: String? = null
  private val main = Handler(Looper.getMainLooper())
  private val io = Executors.newSingleThreadExecutor()

  fun dispatch(action: String, seekTo: Double? = null) {
    main.post { listener?.invoke(action, seekTo) }
  }

  fun update(context: Context, newState: MediaState) {
    main.post {
      val s = ensureSession(context)
      state = newState
      s.setMetadata(buildMetadata(newState))
      s.setPlaybackState(buildPlaybackState(newState))
      s.isActive = true
      loadArtwork(context, newState.artworkUrl)
      refreshService(context)
    }
  }

  fun clear(context: Context) {
    main.post {
      state = null
      artwork = null
      artworkUrl = null
      session?.run {
        isActive = false
        release()
      }
      session = null
      context.stopService(Intent(context, MediaPlaybackService::class.java))
    }
  }

  private fun refreshService(context: Context) {
    if (MediaPlaybackService.running) {
      MediaPlaybackService.instance?.refresh()
    } else if (state?.playing == true) {
      // Started only while playing: Android forbids starting it from the background later.
      ContextCompat.startForegroundService(context, Intent(context, MediaPlaybackService::class.java))
    }
  }

  private fun ensureSession(context: Context): MediaSessionCompat {
    session?.let { return it }
    return MediaSessionCompat(context, "huEVO").apply {
      setCallback(object : MediaSessionCompat.Callback() {
        override fun onPlay() = dispatch("play")
        override fun onPause() = dispatch("pause")
        override fun onStop() = dispatch("stop")
        override fun onSkipToNext() = dispatch("nexttrack")
        override fun onSkipToPrevious() = dispatch("previoustrack")
        override fun onSeekTo(pos: Long) = dispatch("seekto", pos / 1000.0)
      })
      session = this
    }
  }

  private fun buildMetadata(s: MediaState): MediaMetadataCompat =
    MediaMetadataCompat.Builder()
      .putString(MediaMetadataCompat.METADATA_KEY_TITLE, s.title)
      .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, s.artist)
      .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, s.album)
      .apply {
        if (s.duration > 0) putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (s.duration * 1000).toLong())
        artwork?.let { putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it) }
      }
      .build()

  private fun buildPlaybackState(s: MediaState): PlaybackStateCompat {
    var actions = PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE or
      PlaybackStateCompat.ACTION_PLAY_PAUSE or PlaybackStateCompat.ACTION_STOP
    if ("nexttrack" in s.actions) actions = actions or PlaybackStateCompat.ACTION_SKIP_TO_NEXT
    if ("previoustrack" in s.actions) actions = actions or PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
    if ("seekto" in s.actions) actions = actions or PlaybackStateCompat.ACTION_SEEK_TO
    val position = if (s.position >= 0) (s.position * 1000).toLong()
      else PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN
    return PlaybackStateCompat.Builder()
      .setActions(actions)
      .setState(
        if (s.playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
        position,
        if (s.playing) s.rate.toFloat() else 0f,
        SystemClock.elapsedRealtime(),
      )
      .build()
  }

  private fun loadArtwork(context: Context, url: String?) {
    if (url == artworkUrl) return
    artworkUrl = url
    artwork = null
    if (url.isNullOrEmpty()) return
    io.execute {
      val bitmap = runCatching {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000
        conn.readTimeout = 10_000
        CookieManager.getInstance().getCookie(url)?.let { conn.setRequestProperty("Cookie", it) }
        conn.inputStream.use { BitmapFactory.decodeStream(it) }
      }.getOrNull()
      main.post {
        if (url != artworkUrl || bitmap == null) return@post
        artwork = bitmap
        state?.let { s ->
          session?.setMetadata(buildMetadata(s))
          refreshService(context)
        }
      }
    }
  }
}
