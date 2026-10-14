package expo.modules.nubanknotificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class NubankNotificationListenerService : NotificationListenerService() {
  private lateinit var speechQueue: PixSpeechQueue

  override fun onCreate() {
    super.onCreate()
    speechQueue = PixSpeechQueue(this) { key, packageName, postTime ->
      if (PixSpeechQueue.isSupportedBankPackage(packageName)) {
        try {
          cancelCapturedNotification(key, packageName, postTime)
          android.util.Log.i(TAG, "Notificação de Pix recebido removida após persistir a fila: $packageName")
        } catch (error: RuntimeException) {
          android.util.Log.e(TAG, "Não foi possível remover a notificação de Pix recebido.", error)
        }
      }
    }
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    activeListener = this
    speechQueue.processPending()
  }

  override fun onNotificationPosted(statusBarNotification: StatusBarNotification) {
    val extras = statusBarNotification.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
    val textLines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
      ?.map { it.toString() }
      .orEmpty()
    val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty()
    val summaryText = extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)?.toString().orEmpty()
    val capturedEvents = if (::speechQueue.isInitialized) {
      speechQueue.enqueue(statusBarNotification, title, text, bigText, textLines, subText, summaryText)
    } else {
      emptyList()
    }

    if (capturedEvents.isNotEmpty()) {
      capturedEvents.forEach { NubankNotificationListenerModule.dispatchNotification(it) }
    } else {
      NubankNotificationListenerModule.dispatchNotification(
        mapOf(
          "packageName" to statusBarNotification.packageName,
          "id" to statusBarNotification.id,
          "title" to title,
          "text" to text,
          "bigText" to bigText,
          "textLines" to textLines,
          "subText" to subText,
          "summaryText" to summaryText,
          "postTime" to statusBarNotification.postTime,
          "key" to statusBarNotification.key
        )
      )
    }
  }

  override fun onDestroy() {
    if (::speechQueue.isInitialized) {
      speechQueue.shutdown()
    }
    if (activeListener === this) {
      activeListener = null
    }
    super.onDestroy()
  }

  fun setMonitoringEnabled(enabled: Boolean) {
    speechQueue.setMonitoringEnabled(enabled)
  }

  companion object {
    private const val TAG = "PixFalaNotification"
    @Volatile
    private var activeListener: NubankNotificationListenerService? = null

    fun cancelCapturedNotification(key: String, packageName: String, postTime: Long) {
      require(key.isNotBlank()) { "A chave da notificação não pode estar vazia." }
      require(PixSpeechQueue.isSupportedBankPackage(packageName)) {
        "O pacote da notificação não pertence a um banco Pix compatível."
      }
      val listener = activeListener
        ?: throw IllegalStateException("O serviço de leitura de notificações não está conectado.")
      val activeNotification = listener.activeNotifications
        ?.firstOrNull { it.key == key }
        ?: throw IllegalStateException("A notificação já não está ativa; ela não foi removida.")
      require(activeNotification.packageName == packageName && activeNotification.postTime == postTime) {
        "A notificação mudou desde a captura; ela não foi removida."
      }
      listener.cancelNotification(key)
    }

    fun ensurePixSpeechQueued(
      eventId: String,
      key: String,
      postTime: Long,
      packageName: String,
      amount: String,
      payer: String
    ): Boolean {
      if (!PixSpeechQueue.isSupportedBankPackage(packageName)) return false
      return activeListener?.speechQueue?.ensurePixSpeechQueued(
        eventId,
        key,
        postTime,
        packageName,
        amount,
        payer
      ) ?: false
    }

    fun getPendingPixReports(): List<Map<String, Any>> =
      activeListener?.speechQueue?.getPendingPixReports() ?: emptyList()

    fun markPixReportStored(eventId: String): Boolean =
      activeListener?.speechQueue?.markPixReportStored(eventId) ?: false

    fun setMonitoringEnabled(context: android.content.Context, enabled: Boolean) {
      if (!PixFalaPreferences.setMonitoringEnabled(context, enabled)) {
        throw IllegalStateException("Não foi possível salvar o estado de monitoramento do PixFala.")
      }
      activeListener?.setMonitoringEnabled(enabled)
      if (!enabled) {
        context.stopService(
          android.content.Intent(context, PixFalaForegroundService::class.java)
        )
      }
    }
  }
}
