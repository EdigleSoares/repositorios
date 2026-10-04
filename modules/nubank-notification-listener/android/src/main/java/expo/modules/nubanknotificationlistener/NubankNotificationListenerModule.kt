package expo.modules.nubanknotificationlistener

import android.content.ComponentName
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NubankNotificationListenerModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("NubankNotificationListener")

    Events("onNotificationReceived")

    Function("isNotificationPermissionGranted") {
      val context = appContext.reactContext ?: return@Function false
      val enabledListeners = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners"
      ) ?: return@Function false
      val expectedComponent = ComponentName(context, NubankNotificationListenerService::class.java)

      enabledListeners.split(':').any { component ->
        ComponentName.unflattenFromString(component) == expectedComponent
      }
    }

    Function("openNotificationListenerSettings") {
      val context = appContext.reactContext ?: return@Function Unit
      context.startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      Unit
    }

    OnCreate {
      activeInstance = this@NubankNotificationListenerModule
    }

    OnDestroy {
      if (activeInstance === this@NubankNotificationListenerModule) {
        activeInstance = null
      }
    }
  }

  private fun emitNotification(notification: Map<String, Any>) {
    mainHandler.post {
      if (activeInstance === this) {
        sendEvent("onNotificationReceived", notification)
      }
    }
  }

  companion object {
    @Volatile
    private var activeInstance: NubankNotificationListenerModule? = null

    fun dispatchNotification(notification: Map<String, Any>) {
      activeInstance?.emitNotification(notification)
    }
  }
}
