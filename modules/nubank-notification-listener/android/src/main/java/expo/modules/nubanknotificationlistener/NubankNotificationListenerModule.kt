package expo.modules.nubanknotificationlistener

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.Build
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

    Function("isIgnoringBatteryOptimizations") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function true
      val powerManager = context.getSystemService(PowerManager::class.java)
        ?: throw IllegalStateException("Não foi possível consultar a otimização de bateria.")
      powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("requestIgnoreBatteryOptimizations") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto Android não está disponível.")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        context.startActivity(
          Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:${context.packageName}")
          ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
      Unit
    }

    Function("startForegroundTracking") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto Android não está disponível.")
      val intent = Intent(context, PixFalaForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      Unit
    }

    Function("stopForegroundTracking") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto Android não está disponível.")
      context.stopService(Intent(context, PixFalaForegroundService::class.java))
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
