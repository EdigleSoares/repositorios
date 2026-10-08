package expo.modules.nubanknotificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class NubankNotificationListenerService : NotificationListenerService() {
  private lateinit var speechQueue: PixSpeechQueue

  override fun onCreate() {
    super.onCreate()
    speechQueue = PixSpeechQueue(this) { key, packageName ->
      if (packageName in BANK_PACKAGES) {
        try {
          cancelNotification(key)
          android.util.Log.i(TAG, "Notificação bancária removida após persistir a fala: $packageName")
        } catch (error: RuntimeException) {
          android.util.Log.e(TAG, "Não foi possível remover a notificação bancária após persistir a fala.", error)
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
    if (::speechQueue.isInitialized) {
      speechQueue.enqueue(statusBarNotification)
    }
    NubankNotificationListenerModule.dispatchNotification(
      mapOf(
        "packageName" to statusBarNotification.packageName,
        "id" to statusBarNotification.id,
        "title" to extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty(),
        "text" to extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty(),
        "bigText" to extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty(),
        "subText" to extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty(),
        "summaryText" to extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)?.toString().orEmpty(),
        "postTime" to statusBarNotification.postTime,
        "key" to statusBarNotification.key
      )
    )
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
    private val BANK_PACKAGES = setOf(
      "com.nu.production",
      "com.bmg.banco.mobile",
      "br.com.bancobmg.bancodigital",
      "com.neon",
      "com.c6bank.app",
      "br.com.bb.android",
      "com.bradesco",
      "br.com.bradesco.next",
      "com.itau",
      "com.itau.personnalite",
      "com.santander.app",
      "com.mercadopago.wallet",
      "br.gov.caixa.tem",
      "br.com.gft.caixa",
      "br.com.intermedium",
      "br.com.uol.ps",
      "com.picpay",
      "br.com.stone.ton",
      "co.stone.pos.android"
    )
    @Volatile
    private var activeListener: NubankNotificationListenerService? = null

    fun cancelCapturedNotification(key: String) {
      val listener = activeListener
        ?: throw IllegalStateException("O serviço de leitura de notificações não está conectado.")
      listener.cancelNotification(key)
    }

    fun confirmPixStored(key: String, postTime: Long) {
      activeListener?.speechQueue?.confirmStored(key, postTime)
    }

    fun enqueueJavascriptFallback(
      key: String,
      postTime: Long,
      packageName: String,
      amount: String,
      payer: String
    ): Boolean = activeListener?.speechQueue?.enqueueJavascriptFallback(
      key,
      postTime,
      packageName,
      amount,
      payer
    ) ?: false

    fun claimJavascriptSpeech(key: String, postTime: Long): String =
      activeListener?.speechQueue?.claimJavascriptSpeech(key, postTime) ?: "not-found"

    fun completeJavascriptSpeech(key: String, postTime: Long): Boolean =
      activeListener?.speechQueue?.completeJavascriptSpeech(key, postTime) ?: false

    fun releaseJavascriptSpeech(key: String, postTime: Long): Boolean =
      activeListener?.speechQueue?.releaseJavascriptSpeech(key, postTime) ?: false

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
