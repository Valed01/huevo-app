package su.huevo.media

import android.app.Activity
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
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebView
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import kotlin.math.abs

/**
 * Mirrors the site's player (navigator.mediaSession shim in the WebView) into a
 * MediaSession + notification.
 *
 * Everything talks to the WebView directly: React Native only flushes WebView
 * commands/events while the UI is drawing, which stops when the app is in
 * background. So commands go through evaluateJavascript and state is polled
 * from window.__hueMS.snapshot().
 */
object MediaController {
  private const val POLL_MS = 1000L

  var session: MediaSessionCompat? = null
    private set
  var state: MediaState? = null
    private set
  var artwork: Bitmap? = null
    private set

  private var appContext: Context? = null
  private var webView = WeakReference<WebView>(null)
  private var stateAt = 0L
  private var artworkUrl: String? = null
  private val main = Handler(Looper.getMainLooper())
  private val io = Executors.newSingleThreadExecutor()
  private val poll = object : Runnable {
    override fun run() {
      pollPage()
      if (session != null) main.postDelayed(this, POLL_MS)
    }
  }

  /** Transport command from the notification, lock screen or a headset button. */
  fun dispatch(action: String, seekTo: Double? = null) {
    main.post {
      val details = if (seekTo != null) "{\"seekTime\":$seekTo}" else "{}"
      webView.get()?.evaluateJavascript(
        "window.__hueMS && window.__hueMS.fire(${JSONObject.quote(action)}, $details)", null,
      )
      // Reflect the result quickly instead of waiting for the next poll tick.
      main.postDelayed({ pollPage() }, 300)
    }
  }

  fun update(context: Context, newState: MediaState, activity: Activity?) {
    main.post {
      appContext = context
      // Not attached: the WebView was replaced (switching accounts recreates it).
      if (webView.get()?.isAttachedToWindow != true) activity?.window?.decorView?.let { findWebView(it) }?.let {
        webView = WeakReference(it)
      }
      apply(newState)
    }
  }

  fun clear(context: Context) {
    main.post {
      main.removeCallbacks(poll)
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

  private fun apply(newState: MediaState) {
    val context = appContext ?: return
    val old = state
    if (old != null && sameState(old, newState)) return
    val firstUpdate = session == null
    val s = ensureSession(context)
    state = newState
    stateAt = SystemClock.elapsedRealtime()
    s.setMetadata(buildMetadata(newState))
    s.setPlaybackState(buildPlaybackState(newState))
    s.isActive = true
    loadArtwork(newState.artworkUrl)
    refreshService(context)
    if (firstUpdate) main.postDelayed(poll, POLL_MS)
  }

  private fun pollPage() {
    val view = webView.get() ?: return
    view.evaluateJavascript("window.__hueMS ? window.__hueMS.snapshot() : null") { raw ->
      // raw is the JS value encoded as JSON, i.e. a quoted string holding our JSON.
      val json = runCatching { JSONObject(JSONObject("{\"v\":$raw}").getString("v")) }.getOrNull()
        ?: return@evaluateJavascript
      if (json.optBoolean("clear")) {
        appContext?.let { clear(it) }
        return@evaluateJavascript
      }
      apply(parse(json))
    }
  }

  private fun parse(j: JSONObject) = MediaState().apply {
    title = j.optString("title")
    artist = j.optString("artist")
    album = j.optString("album")
    artworkUrl = j.optString("artworkUrl").takeIf { it.isNotEmpty() && it != "null" }
    playing = j.optBoolean("playing")
    position = j.optDouble("position", -1.0)
    duration = j.optDouble("duration", -1.0)
    rate = j.optDouble("rate", 1.0)
    actions = j.optJSONArray("actions")?.let { a -> List(a.length()) { a.getString(it) } } ?: emptyList()
  }

  /** Same track and controls, and the position is where the running clock expects it. */
  private fun sameState(a: MediaState, b: MediaState): Boolean {
    if (a.title != b.title || a.artist != b.artist || a.album != b.album || a.artworkUrl != b.artworkUrl ||
      a.playing != b.playing || a.actions != b.actions || abs(a.duration - b.duration) > 1
    ) return false
    if (a.position < 0 || b.position < 0) return a.position == b.position
    val elapsed = (SystemClock.elapsedRealtime() - stateAt) / 1000.0
    val expected = a.position + if (a.playing) elapsed * a.rate else 0.0
    return abs(b.position - expected) < 1.5
  }

  private fun findWebView(view: View): WebView? {
    if (view is WebView) return view
    if (view is ViewGroup) for (i in 0 until view.childCount) findWebView(view.getChildAt(i))?.let { return it }
    return null
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

  private fun loadArtwork(url: String?) {
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
        val s = state ?: return@post
        session?.setMetadata(buildMetadata(s))
        appContext?.let { refreshService(it) }
      }
    }
  }
}
