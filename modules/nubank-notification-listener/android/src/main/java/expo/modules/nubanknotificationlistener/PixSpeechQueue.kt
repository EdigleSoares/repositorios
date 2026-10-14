package expo.modules.nubanknotificationlistener

import android.content.Context
import android.content.pm.ApplicationInfo
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.service.notification.StatusBarNotification
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
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
  val signature: String,
  val capturedAt: Long,
  var speechCompleted: Boolean,
  var reportStored: Boolean
)

internal data class PixSpeechSettings(
  val template: String,
  val rate: Float,
  val volume: Float
)

private data class PixReceiptCandidate(
  val eventId: String,
  val sourceText: String,
  val amount: String,
  val payer: String
)

internal class PixSpeechQueue(
  private val context: Context,
  private val onDurablyQueued: (String, String, Long) -> Unit
) : TextToSpeech.OnInitListener {
  private val handler = Handler(Looper.getMainLooper())
  private val debugAudioFeedbackEnabled =
    (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
  private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
  private val queue = mutableListOf<PixSpeechItem>()
  private val handledSignatures = linkedMapOf<String, Long>()
  private var textToSpeech: TextToSpeech? = null
  private var initialized = false
  private var currentItemId: String? = null
  private var retryScheduled = false
  private var speechWatchdog: Runnable? = null
  private var toneGenerator: ToneGenerator? = null

  init {
    loadPersistedState()
    toneGenerator = if (debugAudioFeedbackEnabled) {
      try {
        ToneGenerator(AudioManager.STREAM_NOTIFICATION, ToneGenerator.MAX_VOLUME)
      } catch (error: RuntimeException) {
        Log.e(TAG, "Não foi possível preparar o sinal sonoro imediato.", error)
        null
      }
    } else {
      null
    }
    initializeTextToSpeech()
  }

  private fun buildSpeechText(item: PixSpeechItem, settings: PixSpeechSettings): String =
    settings.template
      .replace("{valor}", amountInWords(item.amount), ignoreCase = true)
      .replace("{nome}", item.payer.split(WHITESPACE_PATTERN).firstOrNull() ?: "Cliente", ignoreCase = true)
      .replace("{sobrenome}", item.payer.split(WHITESPACE_PATTERN).getOrNull(1) ?: "", ignoreCase = true)
      .replace(Regex("""\s+([.,!?;:])"""), "$1")
      .replace(WHITESPACE_PATTERN, " ")
      .trim()

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
      Log.i(TAG, "Mecanismo TTS pronto; fila de Pix será processada sem espera pelo JavaScript.")
      processPending()
    }
  }

  fun enqueue(
    notification: StatusBarNotification,
    title: String,
    text: String,
    bigText: String,
    textLines: List<String>,
    subText: String,
    summaryText: String
  ): List<Map<String, Any>> {
    if (!PixFalaPreferences.isMonitoringEnabled(context) ||
      notification.packageName !in BANK_NAMES
    ) return emptyList()

    val sourceText = listOf(title, text, bigText, subText, summaryText)
      .map(::normalizeWhitespace)
      .filter(String::isNotEmpty)
      .distinct()
      .joinToString(" ")
    val receiptCandidates = extractReceiptCandidates(
      notification.key,
      notification.postTime,
      notification.packageName,
      title,
      sourceText,
      textLines
    )
    if (receiptCandidates.isEmpty()) return emptyList()

    val bankName = BANK_NAMES[notification.packageName] ?: notification.packageName
    val postTime = notification.postTime
    val capturedAt = postTime.takeIf { it > 0L } ?: System.currentTimeMillis()
    val newItems = mutableListOf<PixSpeechItem>()
    val createdAtCapture = receiptCandidates.map { candidate ->
      PixSpeechItem(
        id = UUID.randomUUID().toString(),
        notificationKey = notification.key,
        postTime = postTime,
        packageName = notification.packageName,
        amount = candidate.amount,
        payer = candidate.payer,
        signature = candidate.eventId,
        capturedAt = capturedAt,
        speechCompleted = false,
        reportStored = false
      )
    }
    val durablyQueued = synchronized(queue) {
      pruneHandledSignatures()
      createdAtCapture
        .filterNot { item ->
          item.signature in handledSignatures || queue.any { queued -> queued.signature == item.signature }
        }
        .also(newItems::addAll)

      if (newItems.isEmpty()) return@synchronized true

      queue.addAll(newItems)
      if (persistState()) {
        Log.i(TAG, "Pix salvo duravelmente na fila nativa: $bankName; novos eventos: ${newItems.size}.")
        true
      } else {
        queue.removeAll(newItems.toSet())
        false
      }
    }
    if (!durablyQueued) {
      Log.e(TAG, "Pix mantido na barra do sistema porque não foi possível persistir a fila nativa.")
      return emptyList()
    }

    notifyDurablyQueued(notification.key, notification.packageName, postTime)
    if (newItems.isNotEmpty()) {
      playConfirmationTone()
      processPending()
    }
    return receiptCandidates.map { candidate ->
      mapOf(
        "packageName" to notification.packageName,
        "id" to notification.id,
        "title" to "",
        "text" to candidate.sourceText,
        "bigText" to "",
        "textLines" to listOf(candidate.sourceText),
        "subText" to "",
        "summaryText" to "",
        "postTime" to postTime,
        "key" to notification.key,
        "eventId" to candidate.eventId
      )
    }
  }

  fun ensurePixSpeechQueued(
    eventId: String,
    notificationKey: String,
    postTime: Long,
    packageName: String,
    amountText: String,
    payerText: String
  ): Boolean {
    if (
      eventId.isBlank() ||
      notificationKey.isBlank() ||
      !isSupportedBankPackage(packageName)
    ) return false
    val amount = normalizeAmount(amountText) ?: return false
    val payer = payerText.trim().replace(WHITESPACE_PATTERN, " ")
      .split(' ')
      .take(2)
      .joinToString(" ")
      .ifBlank { "Cliente" }
    val signature = eventId
    var newlyQueued = false
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
          signature = signature,
          capturedAt = postTime.takeIf { it > 0L } ?: System.currentTimeMillis(),
          speechCompleted = false,
          reportStored = false
        )
        queue.add(item)
        if (persistState()) {
          newlyQueued = true
          true
        } else {
          queue.remove(item)
          false
        }
      }
    }
    if (!durablyQueued) {
      Log.e(TAG, "Pix recusado: não foi possível persistir a fila nativa.")
      return false
    }
    if (newlyQueued) {
      Log.i(TAG, "Pix confirmado na fila nativa de fala.")
      playConfirmationTone()
      notifyDurablyQueued(notificationKey, packageName, postTime)
      processPending()
    }
    return true
  }

  fun getPendingPixReports(): List<Map<String, Any>> = synchronized(queue) {
    queue.filterNot { it.reportStored }.map { item ->
      mapOf(
        "eventId" to item.signature,
        "notificationKey" to item.notificationKey,
        "postTime" to item.postTime.toDouble(),
        "packageName" to item.packageName,
        "amount" to item.amount,
        "payer" to item.payer
      )
    }
  }

  fun markPixReportStored(eventId: String): Boolean {
    synchronized(queue) {
      val item = queue.firstOrNull { it.signature == eventId }
        ?: return eventId in handledSignatures
      if (item.reportStored) return true

      item.reportStored = true
      val removed = item.speechCompleted && queue.remove(item)
      val handledAt = System.currentTimeMillis()
      if (removed) {
        handledSignatures[item.signature] = handledAt
        pruneHandledSignatures()
      }
      if (!persistState()) {
        item.reportStored = false
        if (removed) {
          queue.add(0, item)
          handledSignatures.remove(item.signature)
        }
        Log.e(TAG, "O registro local não foi confirmado na fila durável; será sincronizado novamente.")
        return false
      }
      Log.i(TAG, "Relatório local confirmado para uma entrada Pix pendente.")
    }
    processPending()
    return true
  }

  fun setMonitoringEnabled(enabled: Boolean) {
    if (enabled) {
      processPending()
      return
    }

    handler.post {
      synchronized(queue) {
        queue.forEach { it.speechCompleted = true }
        val completedItems = queue.filter { it.reportStored }
        queue.removeAll { it.reportStored }
        completedItems.forEach { handledSignatures[it.signature] = System.currentTimeMillis() }
        pruneHandledSignatures()
        if (!persistState()) {
          queue.addAll(0, completedItems)
          completedItems.forEach { handledSignatures.remove(it.signature) }
          Log.e(TAG, "Não foi possível persistir a pausa da fila; entradas pendentes de relatório foram preservadas.")
        }
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

      val item = synchronized(queue) { queue.firstOrNull { !it.speechCompleted } } ?: return@post
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
    toneGenerator?.release()
    toneGenerator = null
    initialized = false
  }

  private fun playConfirmationTone() {
    if (!debugAudioFeedbackEnabled) return

    val played = toneGenerator?.startTone(ToneGenerator.TONE_PROP_ACK, CONFIRMATION_TONE_DURATION_MS)
    if (played != true) {
      Log.w(TAG, "O sinal sonoro imediato não pôde ser iniciado; a fala TTS continuará.")
    } else {
      Log.i(TAG, "Sinal sonoro imediato enviado ao sistema de áudio.")
    }
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
      override fun onStart(utteranceId: String?) {
        if (utteranceId == item.id) {
          val latencyMs = (System.currentTimeMillis() - item.capturedAt).coerceAtLeast(0L)
          Log.i(TAG, "TTS iniciou; captura até início: ${latencyMs}ms.")
        }
      }

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

    val dispatchLatencyMs = (System.currentTimeMillis() - item.capturedAt).coerceAtLeast(0L)
    Log.i(TAG, "Enviando confirmação ao TTS; captura até envio: ${dispatchLatencyMs}ms.")
    val settings = PixFalaPreferences.getSpeechSettings(context)
    val speechRateResult = engine.setSpeechRate(settings.rate)
    if (speechRateResult == TextToSpeech.ERROR) {
      Log.w(TAG, "O mecanismo TTS recusou a velocidade configurada; será usada a velocidade normal.")
      engine.setSpeechRate(1f)
    }
    val speechParameters = Bundle().apply {
      putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, settings.volume)
    }
    val result = engine.speak(
      buildSpeechText(item, settings),
      TextToSpeech.QUEUE_FLUSH,
      speechParameters,
      item.id
    )
    if (result == TextToSpeech.ERROR) {
      Log.e(TAG, "O Android recusou a fala; o Pix continuará na fila.")
      retrySpeech(item)
    }
  }

  private fun complete(item: PixSpeechItem) {
    if (currentItemId != item.id) return
    Log.i(TAG, "Anúncio de voz concluído.")
    currentItemId = null
    speechWatchdog?.let(handler::removeCallbacks)
    speechWatchdog = null
    synchronized(queue) {
      item.speechCompleted = true
      val removed = item.reportStored && queue.remove(item)
      if (removed) {
        handledSignatures[item.signature] = System.currentTimeMillis()
        pruneHandledSignatures()
      }
      if (!persistState()) {
        if (removed) {
          queue.add(0, item)
          handledSignatures.remove(item.signature)
        }
        Log.e(TAG, "A conclusão da fala não foi persistida; a entrada foi mantida no diário local.")
      }
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
            signature = item.getString("signature"),
            capturedAt = item.getLong("capturedAt"),
            speechCompleted = item.optBoolean("speechCompleted", false),
            reportStored = item.optBoolean("reportStored", false)
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

  private fun persistState(): Boolean {
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
          .put("signature", item.signature)
          .put("capturedAt", item.capturedAt)
          .put("speechCompleted", item.speechCompleted)
          .put("reportStored", item.reportStored)
      )
    }
    val savedSignatures = JSONArray()
    handledSignatures.forEach { (signature, timestamp) ->
      savedSignatures.put(
        JSONObject()
          .put("signature", signature)
          .put("timestamp", timestamp)
      )
    }
    return try {
      val persisted = preferences.edit()
        .putString(KEY_QUEUE, savedQueue.toString())
        .putString(KEY_HANDLED, savedSignatures.toString())
        .commit()
      if (!persisted) {
        Log.e(TAG, "O Android não confirmou a gravação persistente da fila de voz.")
      }
      persisted
    } catch (error: RuntimeException) {
      Log.e(TAG, "Falha ao gravar a fila persistente de voz.", error)
      false
    }
  }

  private fun notifyDurablyQueued(notificationKey: String, packageName: String, postTime: Long) {
    try {
      onDurablyQueued(notificationKey, packageName, postTime)
    } catch (error: RuntimeException) {
      Log.e(TAG, "Pix salvo na fila, mas não foi possível limpar a notificação do banco.", error)
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

  private fun normalizeWhitespace(value: String): String =
    value.replace(NON_BREAKING_SPACES_PATTERN, " ")
      .replace(WHITESPACE_PATTERN, " ")
      .trim()

  private fun extractReceiptCandidates(
    notificationKey: String,
    postTime: Long,
    packageName: String,
    title: String,
    sourceText: String,
    textLines: List<String>
  ): List<PixReceiptCandidate> {
    val identicalLineOccurrences = mutableMapOf<String, Int>()
    val lineCandidates = textLines.mapNotNull { line ->
      val candidateText = normalizeWhitespace("$title $line")
      val identityText = normalizeWhitespace(line)
      val occurrence = identicalLineOccurrences.getOrDefault(identityText, 0)
      identicalLineOccurrences[identityText] = occurrence + 1
      parseReceiptCandidate(notificationKey, 0L, packageName, candidateText, occurrence, identityText)
    }
    if (lineCandidates.isNotEmpty()) return lineCandidates

    val candidateText = normalizeWhitespace(sourceText)
    return listOfNotNull(
      parseReceiptCandidate(notificationKey, postTime, packageName, candidateText, 0)
    )
  }

  private fun parseReceiptCandidate(
    notificationKey: String,
    postTime: Long,
    packageName: String,
    sourceText: String,
    eventIndex: Int,
    identityText: String = sourceText
  ): PixReceiptCandidate? {
    val normalizedText = normalize(sourceText)
    if (OUTGOING_PATTERN.containsMatchIn(normalizedText) ||
      !INCOMING_PATTERN.containsMatchIn(normalizedText) ||
      (!EXPLICIT_PIX_PATTERN.containsMatchIn(normalizedText) &&
        !TRANSFER_RECEIVED_PATTERN.containsMatchIn(normalizedText))
    ) return null

    val amount = AMOUNT_PATTERN.find(sourceText)?.groupValues?.getOrNull(1)
      ?.trimEnd('.', ',')
      ?.let(::normalizeAmount)
      ?: return null
    val payer = extractPayer(sourceText)
    return PixReceiptCandidate(
      eventId = createPixEventId(
        notificationKey,
        postTime,
        packageName,
        eventIndex,
        amount,
        payer,
        normalizeWhitespace(normalize(identityText))
      ),
      sourceText = sourceText,
      amount = amount,
      payer = payer
    )
  }

  private fun createPixEventId(
    notificationKey: String,
    postTime: Long,
    packageName: String,
    eventIndex: Int,
    amount: String,
    payer: String,
    normalizedSourceText: String
  ): String {
    val identity = listOf(
      notificationKey,
      postTime.toString(),
      packageName,
      eventIndex.toString(),
      amount,
      payer,
      normalizedSourceText
    ).joinToString("\u001f")
    val digest = MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8))
    val hexDigits = "0123456789abcdef"
    val eventHash = digest.take(16).joinToString("") { byte ->
      val value = byte.toInt() and 0xff
      "${hexDigits[value ushr 4]}${hexDigits[value and 0x0f]}"
    }
    return "pix-$eventHash"
  }

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
    private const val CONFIRMATION_TONE_DURATION_MS = 250
    private const val SPEECH_RETRY_DELAY_MS = 15_000L
    private const val SPEECH_WATCHDOG_MS = 45_000L
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
    private val DIACRITICS_PATTERN = "\\p{Mn}+".toRegex()
    private val WHITESPACE_PATTERN = "\\s+".toRegex()
    private val NON_BREAKING_SPACES_PATTERN = "[\\u00A0\\u2007\\u202F]".toRegex()
    private val OUTGOING_PATTERN =
      Regex("""\b(pix\s+(enviado|enviada|efetuado|efetuada|realizado|realizada|feito|feita)|transferencia\s+(pix\s+)?(enviada|realizada)|enviado|enviada|enviou|enviei|realizado|realizada|realizou|efetuado|efetuada|efetuou|agendado|agendada|agendou|comprovante|fatura|compra|comprou|cartao|saque|investimento|paga\w*|pagou|pagamento\s+(realizado|efetuado)|debito|saida)\w*\b""")
    private val INCOMING_PATTERN =
      Regex("""\b(pix\s+recebido|recebeu|recebido|recebida|recebemos|credito\s+recebido|transferencia\s+(pix\s+)?recebida|voce\s+recebeu)\b""")
    private val EXPLICIT_PIX_PATTERN = Regex("""\bpix\b""")
    private val TRANSFER_RECEIVED_PATTERN =
      Regex("""\btransferencia\s+(pix\s+)?recebida\b""")
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
      "br.com.bancobmg.bancodigital" to "BMG",
      "com.neon" to "Neon",
      "br.com.neon" to "Neon",
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

    fun isSupportedBankPackage(packageName: String): Boolean =
      packageName in BANK_NAMES
  }
}

internal object PixFalaPreferences {
  private const val TAG = "PixFalaPreferences"
  private const val PREFERENCES_NAME = "pixfala_native_monitoring"
  private const val KEY_MONITORING_ENABLED = "monitoring_enabled"
  private const val KEY_SPEECH_TEMPLATE = "speech_template"
  private const val KEY_SPEECH_RATE = "speech_rate"
  private const val KEY_SPEECH_VOLUME = "speech_volume"
  private const val DEFAULT_SPEECH_TEMPLATE =
    "Pix recebido de {valor} de {nome} {sobrenome}. Muito obrigado!"
  private const val MAX_SPEECH_TEMPLATE_LENGTH = 180

  fun isMonitoringEnabled(context: Context): Boolean =
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .getBoolean(KEY_MONITORING_ENABLED, true)

  fun getSpeechSettings(context: Context): PixSpeechSettings {
    val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    val template = preferences.getString(KEY_SPEECH_TEMPLATE, DEFAULT_SPEECH_TEMPLATE)
      ?: DEFAULT_SPEECH_TEMPLATE
    val rate = preferences.getFloat(KEY_SPEECH_RATE, 1f)
    val volume = preferences.getFloat(KEY_SPEECH_VOLUME, 1f)
    if (template.isBlank() || template.length > MAX_SPEECH_TEMPLATE_LENGTH ||
      rate !in setOf(1f, 1.5f, 2f) || volume !in 0f..1f
    ) {
      throw IllegalStateException("As configurações de voz salvas são inválidas.")
    }
    return PixSpeechSettings(template, rate, volume)
  }

  fun setSpeechSettings(context: Context, template: String, rate: Float, volume: Float): Boolean {
    val normalizedTemplate = template.trim()
    require(normalizedTemplate.isNotEmpty() && normalizedTemplate.length <= MAX_SPEECH_TEMPLATE_LENGTH) {
      "A frase precisa ter entre 1 e $MAX_SPEECH_TEMPLATE_LENGTH caracteres."
    }
    require(rate in setOf(1f, 1.5f, 2f)) {
      "Selecione uma velocidade de fala disponível."
    }
    require(volume.isFinite() && volume in 0f..1f) {
      "O volume da fala deve estar entre 0% e 100%."
    }
    val saved = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_SPEECH_TEMPLATE, normalizedTemplate)
      .putFloat(KEY_SPEECH_RATE, rate)
      .putFloat(KEY_SPEECH_VOLUME, volume)
      .remove("speech_name_parts_version")
      .remove("speech_name_count")
      .commit()
    if (!saved) {
      Log.e(TAG, "O Android não confirmou a gravação das configurações de voz.")
    }
    return saved
  }

  fun setMonitoringEnabled(context: Context, enabled: Boolean): Boolean =
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_MONITORING_ENABLED, enabled)
      .commit()
}
