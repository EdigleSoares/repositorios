package expo.modules.nubanknotificationlistener

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.service.notification.StatusBarNotification
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.text.Normalizer
import java.util.Locale
import java.util.UUID

private data class PixSpeechItem(
  val id: String,
  val notificationKey: String,
  val postTime: Long,
  val packageName: String,
  val amount: String,
  val payer: String,
  val text: String,
  val signature: String,
  val capturedAt: Long,
  var stored: Boolean,
  var javascriptSpeechClaimedAt: Long
)

internal class PixSpeechQueue(
  private val context: Context,
  private val onDurablyQueued: (String, String) -> Unit
) : TextToSpeech.OnInitListener {
  private val handler = Handler(Looper.getMainLooper())
  private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
  private val queue = mutableListOf<PixSpeechItem>()
  private val handledSignatures = linkedMapOf<String, Long>()
  private var textToSpeech: TextToSpeech? = null
  private var initialized = false
  private var currentItemId: String? = null
  private var retryScheduled = false
  private var speechWatchdog: Runnable? = null

  init {
    loadPersistedState()
    initializeTextToSpeech()
  }

  override fun onInit(status: Int) {
    handler.post {
      if (status != TextToSpeech.SUCCESS) {
        Log.e(TAG, "O mecanismo nativo de voz não foi inicializado; a fila será tentada novamente.")
        initialized = false
        textToSpeech?.shutdown()
        textToSpeech = null
        scheduleRetry()
        return@post
      }

      val engine = textToSpeech ?: return@post
      val localeStatus = engine.setLanguage(Locale("pt", "BR"))
      if (localeStatus == TextToSpeech.LANG_MISSING_DATA ||
        localeStatus == TextToSpeech.LANG_NOT_SUPPORTED
      ) {
        Log.w(TAG, "Voz pt-BR indisponível; será usada a voz padrão instalada no Android.")
        engine.setLanguage(Locale.getDefault())
      }
      initialized = true
      retryScheduled = false
      processPending()
    }
  }

  fun enqueue(notification: StatusBarNotification): Boolean {
    if (!PixFalaPreferences.isMonitoringEnabled(context)) return false

    val extras = notification.notification.extras
    val title = extras.getCharSequence(android.app.Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = extras.getCharSequence(android.app.Notification.EXTRA_TEXT)?.toString().orEmpty()
    val bigText = extras.getCharSequence(android.app.Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
    val subText = extras.getCharSequence(android.app.Notification.EXTRA_SUB_TEXT)?.toString().orEmpty()
    val summaryText = extras.getCharSequence(android.app.Notification.EXTRA_SUMMARY_TEXT)?.toString().orEmpty()
    val sourceText = listOf(title, text, bigText, subText, summaryText)
      .map(String::trim)
      .filter(String::isNotEmpty)
      .distinct()
      .joinToString(" ")
    val normalizedText = normalize(sourceText)

    if (OUTGOING_PATTERN.containsMatchIn(normalizedText) ||
      !INCOMING_PATTERN.containsMatchIn(normalizedText)
    ) return false

    val amount = AMOUNT_PATTERN.find(sourceText)?.groupValues?.getOrNull(1)
      ?.let(::normalizeAmount)
      ?: return false
    val payer = extractPayer(sourceText)
    val bankName = BANK_NAMES[notification.packageName] ?: notification.packageName
    val greeting = GREETINGS.random()
    val thankYou = THANK_YOU_PHRASES.random()
    val speech = "$greeting Pix recebido no valor de ${amountInWords(amount)} de $payer. $thankYou!"
    val postTime = notification.postTime
    val signature = "${notification.key}|$postTime|${notification.packageName}|$amount"

    val durablyQueued = synchronized(queue) {
      pruneHandledSignatures()
      if (signature in handledSignatures || queue.any { it.signature == signature }) {
        Log.i(TAG, "Notificação Pix duplicada ignorada: $bankName")
        true
      } else {
        val item = PixSpeechItem(
          id = UUID.randomUUID().toString(),
          notificationKey = notification.key,
          postTime = postTime,
          packageName = notification.packageName,
          amount = amount,
          payer = payer,
          text = speech,
          signature = signature,
          capturedAt = System.currentTimeMillis(),
          stored = false,
          javascriptSpeechClaimedAt = 0L
        )
        queue.add(item)
        if (persistQueue()) {
          Log.i(TAG, "Pix salvo duravelmente na fila nativa: $bankName, R$ $amount, $payer")
          true
        } else {
          queue.remove(item)
          false
        }
      }
    }
    if (!durablyQueued) {
      Log.e(TAG, "Pix mantido na barra do sistema porque não foi possível persistir a fila nativa.")
      return false
    }
    notifyDurablyQueued(notification.key, notification.packageName)
    processPending()
    return true
  }

  fun confirmStored(notificationKey: String, postTime: Long) {
    synchronized(queue) {
      val item = queue.firstOrNull {
        it.notificationKey == notificationKey && it.postTime == postTime && !it.stored
      } ?: return
      item.stored = true
      if (!persistQueue()) {
        item.stored = false
        Log.e(TAG, "A confirmação do relatório não foi persistida; será usada a janela de segurança.")
        return
      }
      Log.i(TAG, "Registro do Pix confirmado; liberando fala nativa.")
    }
    processPending()
  }

  fun enqueueJavascriptFallback(
    notificationKey: String,
    postTime: Long,
    packageName: String,
    amountText: String,
    payerText: String
  ): Boolean {
    if (notificationKey.isBlank()) return false
    val amount = normalizeAmount(amountText) ?: return false
    val payer = payerText.trim().replace(WHITESPACE_PATTERN, " ")
      .split(' ')
      .take(2)
      .joinToString(" ")
      .ifBlank { "Cliente" }
    val signature = "$notificationKey|$postTime|$packageName|$amount"
    val durablyQueued = synchronized(queue) {
      if (signature in handledSignatures || queue.any { it.signature == signature }) {
        true
      } else {
        val item = PixSpeechItem(
          id = UUID.randomUUID().toString(),
          notificationKey = notificationKey,
          postTime = postTime,
          packageName = packageName,
          amount = amount,
          payer = payer,
          text = "Pix recebido no valor de ${amountInWords(amount)} de $payer.",
          signature = signature,
          capturedAt = System.currentTimeMillis(),
          stored = false,
          javascriptSpeechClaimedAt = 0L
        )
        queue.add(item)
        if (persistQueue()) {
          true
        } else {
          queue.remove(item)
          false
        }
      }
    }
    if (!durablyQueued) {
      Log.e(TAG, "Fallback de Pix recusado: não foi possível persistir a fila nativa.")
      return false
    }
    Log.w(TAG, "Fila nativa de contingência criada a partir do registro JavaScript.")
    notifyDurablyQueued(notificationKey, packageName)
    processPending()
    return true
  }

  fun claimJavascriptSpeech(notificationKey: String, postTime: Long): String {
    synchronized(queue) {
      val item = queue.firstOrNull {
        it.notificationKey == notificationKey && it.postTime == postTime
      } ?: return "not-found"
      if (currentItemId == item.id) return "native-speaking"
      item.javascriptSpeechClaimedAt = System.currentTimeMillis()
      if (!persistQueue()) {
        item.javascriptSpeechClaimedAt = 0L
        Log.e(TAG, "Não foi possível persistir a reserva da fala Expo; o TTS nativo seguirá.")
        return "native-fallback"
      }
      Log.i(TAG, "A fala JavaScript assumiu o anúncio; o TTS nativo fica como contingência.")
      return "claimed"
    }
  }

  fun completeJavascriptSpeech(notificationKey: String, postTime: Long): Boolean {
    val item = synchronized(queue) {
      val matchedItem = queue.firstOrNull {
        it.notificationKey == notificationKey && it.postTime == postTime &&
          it.javascriptSpeechClaimedAt > 0L
      } ?: return false
      queue.remove(matchedItem)
      handledSignatures[matchedItem.signature] = System.currentTimeMillis()
      pruneHandledSignatures()
      persistQueue()
      persistHandledSignatures()
      matchedItem
    }
    Log.i(TAG, "Fala JavaScript concluída para Pix de R$ ${item.amount}.")
    processPending()
    return true
  }

  fun releaseJavascriptSpeech(notificationKey: String, postTime: Long): Boolean {
    val released = synchronized(queue) {
      val item = queue.firstOrNull {
        it.notificationKey == notificationKey && it.postTime == postTime &&
          it.javascriptSpeechClaimedAt > 0L
      } ?: return false
      item.javascriptSpeechClaimedAt = 0L
      if (!persistQueue()) {
        Log.e(TAG, "Não foi possível persistir a liberação; a reserva expirará automaticamente.")
        return false
      }
      true
    }
    if (released) {
      Log.w(TAG, "A fala JavaScript falhou; transferindo o Pix para o TTS nativo.")
      processPending()
    }
    return released
  }

  fun setMonitoringEnabled(enabled: Boolean) {
    if (enabled) {
      processPending()
      return
    }

    handler.post {
      synchronized(queue) {
        queue.clear()
        persistQueue()
      }
      currentItemId = null
      speechWatchdog?.let(handler::removeCallbacks)
      speechWatchdog = null
      textToSpeech?.stop()
    }
  }

  fun processPending() {
    handler.post {
      if (!PixFalaPreferences.isMonitoringEnabled(context) || !initialized ||
        currentItemId != null
      ) return@post

      val item = synchronized(queue) { queue.firstOrNull() } ?: return@post
      val claimAge = System.currentTimeMillis() - item.javascriptSpeechClaimedAt
      if (item.javascriptSpeechClaimedAt > 0L && claimAge < JAVASCRIPT_SPEECH_TIMEOUT_MS) {
        handler.postDelayed(
          { processPending() },
          JAVASCRIPT_SPEECH_TIMEOUT_MS - claimAge
        )
        return@post
      }
      if (item.javascriptSpeechClaimedAt > 0L) {
        synchronized(queue) {
          item.javascriptSpeechClaimedAt = 0L
          persistQueue()
        }
        Log.w(TAG, "A fala JavaScript expirou; o TTS nativo assumirá o Pix.")
      }
      val fallbackDelay = CAPTURE_STORAGE_GRACE_MS - (System.currentTimeMillis() - item.capturedAt)
      if (!item.stored && fallbackDelay > 0) {
        handler.postDelayed({ processPending() }, fallbackDelay)
        return@post
      }

      speak(item)
    }
  }

  fun shutdown() {
    handler.removeCallbacksAndMessages(null)
    currentItemId = null
    speechWatchdog = null
    textToSpeech?.stop()
    textToSpeech?.shutdown()
    textToSpeech = null
    initialized = false
  }

  private fun speak(item: PixSpeechItem) {
    val engine = textToSpeech ?: run {
      initialized = false
      scheduleRetry()
      return
    }
    currentItemId = item.id
    val watchdog = Runnable {
      if (currentItemId == item.id) {
        Log.e(TAG, "A fala excedeu o tempo limite; o Pix será tentado novamente.")
        retrySpeech(item)
      }
    }
    speechWatchdog = watchdog
    handler.postDelayed(watchdog, SPEECH_WATCHDOG_MS)
    engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
      override fun onStart(utteranceId: String?) = Unit

      override fun onDone(utteranceId: String?) {
        handler.post {
          if (currentItemId == item.id) complete(item)
        }
      }

      @Deprecated("Deprecated by Android")
      override fun onError(utteranceId: String?) {
        handler.post {
          if (currentItemId == item.id) retrySpeech(item)
        }
      }

      override fun onError(utteranceId: String?, errorCode: Int) {
        handler.post {
          if (currentItemId == item.id) {
            Log.e(TAG, "Falha na fala nativa (código $errorCode); o Pix continuará na fila.")
            retrySpeech(item)
          }
        }
      }

      override fun onStop(utteranceId: String?, interrupted: Boolean) {
        handler.post {
          if (interrupted && currentItemId == item.id) {
            Log.w(TAG, "A fala foi interrompida pelo Android; o Pix será tentado novamente.")
            retrySpeech(item)
          }
        }
      }
    })

    val result = engine.speak(item.text, TextToSpeech.QUEUE_FLUSH, Bundle(), item.id)
    if (result == TextToSpeech.ERROR) {
      Log.e(TAG, "O Android recusou a fala; o Pix continuará na fila.")
      retrySpeech(item)
    }
  }

  private fun complete(item: PixSpeechItem) {
    if (currentItemId != item.id) return
    Log.i(TAG, "Anúncio de voz concluído para Pix de R$ ${item.amount}.")
    currentItemId = null
    speechWatchdog?.let(handler::removeCallbacks)
    speechWatchdog = null
    synchronized(queue) {
      queue.removeAll { it.id == item.id }
      handledSignatures[item.signature] = System.currentTimeMillis()
      pruneHandledSignatures()
      persistQueue()
      persistHandledSignatures()
    }
    processPending()
  }

  private fun retrySpeech(item: PixSpeechItem) {
    if (currentItemId != item.id) return
    currentItemId = null
    speechWatchdog?.let(handler::removeCallbacks)
    speechWatchdog = null
    initialized = false
    textToSpeech?.stop()
    textToSpeech?.shutdown()
    textToSpeech = null
    scheduleRetry()
  }

  private fun initializeTextToSpeech() {
    if (textToSpeech != null) return
    try {
      textToSpeech = TextToSpeech(context, this)
    } catch (error: RuntimeException) {
      Log.e(TAG, "Não foi possível criar o mecanismo nativo de voz.", error)
      scheduleRetry()
    }
  }

  private fun scheduleRetry() {
    if (retryScheduled) return
    retryScheduled = true
    handler.postDelayed({
      retryScheduled = false
      initializeTextToSpeech()
    }, SPEECH_RETRY_DELAY_MS)
  }

  private fun loadPersistedState() {
    try {
      val savedQueue = JSONArray(preferences.getString(KEY_QUEUE, "[]"))
      for (index in 0 until savedQueue.length()) {
        val item = savedQueue.getJSONObject(index)
        queue.add(
          PixSpeechItem(
            id = item.getString("id"),
            notificationKey = item.getString("notificationKey"),
            postTime = item.getLong("postTime"),
            packageName = item.getString("packageName"),
            amount = item.getString("amount"),
            payer = item.getString("payer"),
            text = item.getString("text"),
            signature = item.getString("signature"),
            capturedAt = item.getLong("capturedAt"),
            stored = item.optBoolean("stored", false),
            javascriptSpeechClaimedAt = 0L
          )
        )
      }

      val savedSignatures = JSONArray(preferences.getString(KEY_HANDLED, "[]"))
      for (index in 0 until savedSignatures.length()) {
        val item = savedSignatures.getJSONObject(index)
        handledSignatures[item.getString("signature")] = item.getLong("timestamp")
      }
      pruneHandledSignatures()
    } catch (error: Exception) {
      Log.e(TAG, "Não foi possível restaurar completamente a fila persistida de Pix.", error)
    }
  }

  private fun persistQueue(): Boolean {
    val savedQueue = JSONArray()
    queue.forEach { item ->
      savedQueue.put(
        JSONObject()
          .put("id", item.id)
          .put("notificationKey", item.notificationKey)
          .put("postTime", item.postTime)
          .put("packageName", item.packageName)
          .put("amount", item.amount)
          .put("payer", item.payer)
          .put("text", item.text)
          .put("signature", item.signature)
          .put("capturedAt", item.capturedAt)
          .put("stored", item.stored)
      )
    }
    return try {
      val persisted = preferences.edit().putString(KEY_QUEUE, savedQueue.toString()).commit()
      if (!persisted) {
        Log.e(TAG, "O Android não confirmou a gravação persistente da fila de voz.")
      }
      persisted
    } catch (error: RuntimeException) {
      Log.e(TAG, "Falha ao gravar a fila persistente de voz.", error)
      false
    }
  }

  private fun notifyDurablyQueued(notificationKey: String, packageName: String) {
    try {
      onDurablyQueued(notificationKey, packageName)
    } catch (error: RuntimeException) {
      Log.e(TAG, "Pix salvo na fila, mas não foi possível limpar a notificação do banco.", error)
    }
  }

  private fun persistHandledSignatures() {
    val savedSignatures = JSONArray()
    handledSignatures.forEach { (signature, timestamp) ->
      savedSignatures.put(
        JSONObject()
          .put("signature", signature)
          .put("timestamp", timestamp)
      )
    }
    if (!preferences.edit().putString(KEY_HANDLED, savedSignatures.toString()).commit()) {
      Log.e(TAG, "O Android não confirmou a gravação da proteção contra Pix duplicado.")
    }
  }

  private fun pruneHandledSignatures() {
    val oldestTimestamp = System.currentTimeMillis() - HANDLED_SIGNATURE_RETENTION_MS
    handledSignatures.entries.removeAll { it.value < oldestTimestamp }
    while (handledSignatures.size > MAX_HANDLED_SIGNATURES) {
      handledSignatures.remove(handledSignatures.keys.first())
    }
  }

  private fun extractPayer(sourceText: String): String {
    val cleanText = sourceText.replace(CPF_PATTERN, " ")
    val match = PAYER_PATTERN.find(cleanText)?.groupValues?.getOrNull(1)
      ?.trim()
      ?.replace(WHITESPACE_PATTERN, " ")
      ?.split(' ')
      ?.take(2)
      ?.joinToString(" ")
    return match?.takeIf(String::isNotBlank) ?: "Cliente"
  }

  private fun normalize(value: String): String =
    Normalizer.normalize(value, Normalizer.Form.NFD)
      .replace(DIACRITICS_PATTERN, "")
      .lowercase(Locale("pt", "BR"))

  private fun amountInWords(amount: String): String {
    val reais = amount.substringBefore(',').replace(".", "").toLongOrNull()
      ?: return "valor não informado"
    val cents = amount.substringAfter(',').toIntOrNull() ?: 0
    val parts = mutableListOf<String>()

    if (reais > 0) {
      parts.add("${numberInWords(reais)} ${if (reais == 1L) "real" else "reais"}")
    }
    if (cents > 0) {
      parts.add("${numberInWords(cents.toLong())} ${if (cents == 1) "centavo" else "centavos"}")
    }
    return parts.joinToString(" e ").ifEmpty { "zero reais" }
  }

  private fun normalizeAmount(input: String): String? {
    val value = input.trim()
    val integerPart: String
    val decimalPart: String
    when {
      value.contains(',') -> {
        val parts = value.split(',')
        if (parts.size != 2 || !parts[1].matches(Regex("""\d{1,2}"""))) return null
        if (!parts[0].matches(Regex("""\d{1,3}(?:\.\d{3})*|\d+"""))) return null
        integerPart = parts[0].replace(".", "")
        decimalPart = parts[1].padEnd(2, '0')
      }
      value.matches(Regex("""\d{1,3}(?:\.\d{3})+""")) -> {
        integerPart = value.replace(".", "")
        decimalPart = "00"
      }
      value.matches(Regex("""\d+(?:\.\d{1,2})?""")) -> {
        val parts = value.split('.')
        integerPart = parts[0]
        decimalPart = parts.getOrElse(1) { "" }.padEnd(2, '0')
      }
      else -> return null
    }

    val normalizedInteger = integerPart.trimStart('0').ifEmpty { "0" }
    if (normalizedInteger.length > 12) return null
    if (normalizedInteger == "0" && decimalPart == "00") return null
    val groupedInteger = normalizedInteger.reversed()
      .chunked(3)
      .joinToString(".")
      .reversed()
    return "$groupedInteger,$decimalPart"
  }

  private fun numberInWords(value: Long): String {
    if (value < 1_000L) return numberUnderThousand(value.toInt())

    val groups = listOf(
      Triple(1_000_000_000L, "bilhão", "bilhões"),
      Triple(1_000_000L, "milhão", "milhões"),
      Triple(1_000L, "mil", "mil")
    )
    var remainder = value
    val parts = mutableListOf<String>()
    for ((divisor, singular, plural) in groups) {
      val quantity = remainder / divisor
      if (quantity == 0L) continue
      remainder %= divisor
      val quantityWords = if (divisor == 1_000L && quantity == 1L) {
        ""
      } else {
        numberUnderThousand(quantity.toInt())
      }
      val scaleName = if (quantity == 1L) singular else plural
      parts.add(listOf(quantityWords, scaleName).filter(String::isNotEmpty).joinToString(" "))
    }
    if (remainder > 0L) parts.add(numberUnderThousand(remainder.toInt()))
    return parts.joinToString(" e ")
  }

  private fun numberUnderThousand(value: Int): String {
    if (value < 10) return SMALL_NUMBERS[value]
    if (value < 20) return TEENS[value - 10]
    if (value < 100) {
      val remainder = value % 10
      return if (remainder == 0) TENS[value / 10] else "${TENS[value / 10]} e ${SMALL_NUMBERS[remainder]}"
    }
    if (value == 100) return "cem"

    val remainder = value % 100
    val prefix = HUNDREDS[value / 100]
    return if (remainder == 0) prefix else "$prefix e ${numberUnderThousand(remainder)}"
  }

  companion object {
    private const val TAG = "PixFalaSpeechQueue"
    private const val PREFERENCES_NAME = "pixfala_native_monitoring"
    private const val KEY_QUEUE = "speech_queue"
    private const val KEY_HANDLED = "handled_signatures"
    private const val CAPTURE_STORAGE_GRACE_MS = 2_500L
    private const val SPEECH_RETRY_DELAY_MS = 15_000L
    private const val SPEECH_WATCHDOG_MS = 45_000L
    private const val JAVASCRIPT_SPEECH_TIMEOUT_MS = 45_000L
    private const val HANDLED_SIGNATURE_RETENTION_MS = 24 * 60 * 60 * 1000L
    private const val MAX_HANDLED_SIGNATURES = 200
    private val SMALL_NUMBERS =
      listOf("zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove")
    private val TEENS = listOf(
      "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis",
      "dezessete", "dezoito", "dezenove"
    )
    private val TENS =
      listOf("", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa")
    private val HUNDREDS = listOf(
      "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
      "seiscentos", "setecentos", "oitocentos", "novecentos"
    )
    private val GREETINGS = listOf("Olá!", "Atenção!", "Boa notícia!")
    private val THANK_YOU_PHRASES = listOf(
      "Muito obrigado",
      "Obrigado e volte sempre",
      "Tenha um excelente dia",
      "Agradecemos a preferência",
      "Boas compras"
    )
    private val DIACRITICS_PATTERN = "\\p{Mn}+".toRegex()
    private val WHITESPACE_PATTERN = "\\s+".toRegex()
    private val OUTGOING_PATTERN =
      Regex("""\b(enviado|enviada|enviou|realizada|efetuado|agendado|comprovante|fatura|compra|cartao|saque|investimento)\w*\b""")
    private val INCOMING_PATTERN =
      Regex("""\b(pix\s+recebido|recebeu|recebido|recebida|recebemos|credito\s+recebido|transferencia\s+(pix\s+)?recebida|voce\s+recebeu)\b""")
    private val AMOUNT_PATTERN = Regex("""R\$\s*([\d.,]+)""", RegexOption.IGNORE_CASE)
    private val CPF_PATTERN =
      Regex("""(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\*{3}\.\d{3}\.\d{3}-\*{2})""")
    private val PAYER_PATTERN = Regex(
      """\bde\s+(?!R\s*\$)([\p{L}\p{M}][\p{L}\p{M} .'’-]{0,79}?)(?=\s+(?:CPF\b|no\s+valor\b|chave\b|no\s+R\s*\$)|[.!?;]|$)""",
      setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
    )
    private val BANK_NAMES = mapOf(
      "com.nu.production" to "Nubank",
      "com.bmg.banco.mobile" to "BMG",
      "com.neon" to "Neon",
      "com.c6bank.app" to "C6 Bank",
      "br.com.bb.android" to "Banco do Brasil",
      "com.bradesco" to "Bradesco",
      "br.com.bradesco.next" to "Next",
      "com.itau" to "Itaú",
      "com.itau.personnalite" to "Itaú",
      "com.santander.app" to "Santander",
      "com.mercadopago.wallet" to "Mercado Pago",
      "br.gov.caixa.tem" to "Caixa Tem",
      "br.com.gft.caixa" to "Caixa",
      "br.com.intermedium" to "Banco Inter",
      "br.com.uol.ps" to "PagBank",
      "com.picpay" to "PicPay",
      "br.com.stone.ton" to "Ton",
      "co.stone.pos.android" to "Stone"
    )
  }
}

internal object PixFalaPreferences {
  private const val PREFERENCES_NAME = "pixfala_native_monitoring"
  private const val KEY_MONITORING_ENABLED = "monitoring_enabled"

  fun isMonitoringEnabled(context: Context): Boolean =
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .getBoolean(KEY_MONITORING_ENABLED, true)

  fun setMonitoringEnabled(context: Context, enabled: Boolean): Boolean =
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_MONITORING_ENABLED, enabled)
      .commit()
}
