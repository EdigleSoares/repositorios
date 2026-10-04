package expo.modules.nubanknotificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class NubankNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(statusBarNotification: StatusBarNotification) {
    if (statusBarNotification.packageName !in SUPPORTED_BANK_PACKAGES) return

    val extras = statusBarNotification.notification.extras
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

  private companion object {
    val SUPPORTED_BANK_PACKAGES = setOf(
      "com.nu.production",
      "com.itau",
      "com.itau.personnalite",
      "com.bradesco",
      "br.com.bradesco.next",
      "br.com.bb.android",
      "com.mercadopago.wallet",
      "br.gov.caixa.tem",
      "br.com.gft.caixa",
      "br.com.intermedium",
      "br.com.uol.ps",
      "com.c6bank.app",
      "com.bmg.banco.mobile",
      "com.picpay",
      "com.santander.app",
      "com.neon",
      "br.com.stone.ton",
      "co.stone.pos.android"
    )
  }
}
