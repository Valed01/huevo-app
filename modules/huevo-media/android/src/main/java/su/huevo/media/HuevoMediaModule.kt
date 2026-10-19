package su.huevo.media

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class MediaState : Record {
  @Field var title: String = ""
  @Field var artist: String = ""
  @Field var album: String = ""
  @Field var artworkUrl: String? = null
  @Field var playing: Boolean = false
  /** Seconds; negative when unknown. */
  @Field var position: Double = -1.0
  @Field var duration: Double = -1.0
  @Field var rate: Double = 1.0
  @Field var actions: List<String> = emptyList()
}

class HuevoMediaModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HuevoMedia")

    Events("onCommand")

    OnCreate {
      MediaController.listener = { action, seekTo ->
        sendEvent("onCommand", buildMap {
          put("action", action)
          if (seekTo != null) put("seekTime", seekTo)
        })
      }
    }

    OnDestroy {
      MediaController.listener = null
    }

    Function("update") { state: MediaState ->
      appContext.reactContext?.let { MediaController.update(it.applicationContext, state) }
      null
    }

    Function("clear") {
      appContext.reactContext?.let { MediaController.clear(it.applicationContext) }
      null
    }
  }
}
