package expo.modules.nubanknotificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class NubankNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(statusBarNotification: StatusBarNotification) {
    if (statusBarNotification.packageName != NUBANK_PACKAGE) return

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
    const val NUBANK_PACKAGE = "com.nu.production"
  }
}
