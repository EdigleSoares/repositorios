package expo.modules.nubanknotificationlistener

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder

class PixFalaForegroundService : Service() {
  override fun onCreate() {
    super.onCreate()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
        ?: throw IllegalStateException("O serviço de notificações do Android não está disponível.")
      manager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          "Monitoramento do Pix",
          NotificationManager.IMPORTANCE_LOW
        ).apply {
          description = "Mantém ativo o monitoramento de Pix recebido."
          setShowBadge(false)
        }
      )
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = buildNotification()
    startForeground(NOTIFICATION_ID, notification)
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun buildNotification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("PixFala ativo")
      .setContentText("Monitorando Pix recebidos em segundo plano.")
      .setCategory(Notification.CATEGORY_SERVICE)
      .setPriority(Notification.PRIORITY_LOW)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "pixfala_notification_listener"
    private const val NOTIFICATION_ID = 7914
  }
}
