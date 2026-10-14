package expo.modules.nubanknotificationlistener

import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NubankNotificationListenerModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var pixOverlay: View? = null

  override fun definition() = ModuleDefinition {
    Name("NubankNotificationListener")

    Events("onNotificationReceived")

    Function("cancelNotification") { key: String ->
      if (key.isBlank()) {
        throw IllegalArgumentException("A chave da notificação não pode estar vazia.")
      }
      NubankNotificationListenerService.cancelCapturedNotification(key)
      Unit
    }

    Function("ensurePixSpeechQueued") {
      eventId: String,
      key: String,
      postTime: Double,
      packageName: String,
      amount: String,
      payer: String ->
      NubankNotificationListenerService.ensurePixSpeechQueued(
        eventId,
        key,
        postTime.toLong(),
        packageName,
        amount,
        payer
      )
    }

    Function("getPendingPixReports") {
      NubankNotificationListenerService.getPendingPixReports()
    }

    Function("markPixReportStored") { eventId: String ->
      if (eventId.isBlank()) false
      else NubankNotificationListenerService.markPixReportStored(eventId)
    }

    Function("isMonitoringEnabled") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto Android não está disponível.")
      PixFalaPreferences.isMonitoringEnabled(context)
    }

    Function("setMonitoringEnabled") { enabled: Boolean ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto Android não está disponível.")
      NubankNotificationListenerService.setMonitoringEnabled(context, enabled)
      Unit
    }

    Function("getSpeechSettings") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto Android não está disponível.")
      val settings = PixFalaPreferences.getSpeechSettings(context)
      mapOf(
        "template" to settings.template,
        "rate" to settings.rate.toDouble(),
        "volume" to settings.volume.toDouble()
      )
    }

    Function("setSpeechSettings") { template: String, rate: Double, volume: Double ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto Android não está disponível.")
      PixFalaPreferences.setSpeechSettings(context, template, rate.toFloat(), volume.toFloat())
    }

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

    Function("isOverlayPermissionGranted") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function true
      Settings.canDrawOverlays(context)
    }

    Function("openOverlayPermissionSettings") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto Android não está disponível.")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        context.startActivity(
          Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}")
          ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
      Unit
    }

    Function("showPixOverlay") { amount: String, payer: String ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("O contexto Android não está disponível.")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
        throw IllegalStateException("A permissão de sobreposição não foi concedida.")
      }
      val windowManager = context.getSystemService(WindowManager::class.java)
        ?: throw IllegalStateException("O gerenciador de janelas Android não está disponível.")
      val applicationContext = context.applicationContext
      val density = applicationContext.resources.displayMetrics.density
      val card = TextView(applicationContext).apply {
        text = "Pix recebido\nR$ $amount de $payer"
        setTextColor(Color.WHITE)
        textSize = 16f
        gravity = Gravity.CENTER_VERTICAL
        setPadding((20 * density).toInt(), (16 * density).toInt(), (20 * density).toInt(), (16 * density).toInt())
        background = GradientDrawable().apply {
          setColor(Color.rgb(22, 25, 32))
          cornerRadius = 18 * density
          setStroke((1.5f * density).toInt(), Color.rgb(0, 230, 91))
        }
        elevation = 10 * density
      }
      val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE
      }
      val layoutParams = WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        overlayType,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
          WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
          WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        PixelFormat.TRANSLUCENT
      ).apply {
        gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        y = (24 * density).toInt()
      }

      mainHandler.post {
        pixOverlay?.let { previousOverlay ->
          try {
            windowManager.removeView(previousOverlay)
          } catch (error: IllegalArgumentException) {
            Log.w(TAG, "A confirmação flutuante anterior já havia sido removida.", error)
          }
        }
        pixOverlay = card
        try {
          windowManager.addView(card, layoutParams)
        } catch (error: RuntimeException) {
          pixOverlay = null
          Log.e(TAG, "Não foi possível adicionar a confirmação flutuante do Pix.", error)
          return@post
        }
        mainHandler.postDelayed({
          if (pixOverlay === card) {
            try {
              windowManager.removeView(card)
            } catch (error: IllegalArgumentException) {
              Log.w(TAG, "A confirmação flutuante do Pix já havia sido removida.", error)
            }
            pixOverlay = null
          }
        }, OVERLAY_DURATION_MS)
      }
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
    private const val TAG = "PixFalaNotification"
    private const val OVERLAY_DURATION_MS = 5_000L

    @Volatile
    private var activeInstance: NubankNotificationListenerModule? = null

    fun dispatchNotification(notification: Map<String, Any>) {
      activeInstance?.emitNotification(notification)
    }
  }
}
