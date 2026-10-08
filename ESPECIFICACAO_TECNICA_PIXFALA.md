# PixFala — especificação técnica e guia de continuidade

**Atualizado em:** 08/10/2026  
**Objetivo:** dar a outros agentes e desenvolvedores contexto suficiente para entender o app, continuar mudanças com segurança e investigar o monitoramento/anúncio de Pix.

> Este documento descreve o estado do código consultado nesta data. Ele não substitui testes em aparelho Android. Em especial, a compilação Kotlin e o fluxo real de notificações/áudio ainda precisam ser validados em um ambiente com JDK e em um dispositivo.

## 1. Visão geral

PixFala é um aplicativo Android com interface em React Native, Expo e TypeScript. O app monitora notificações financeiras, registra recebimentos Pix localmente, anuncia o recebimento por voz, pode exibir uma confirmação sobre outros apps e gera cobranças Pix estáticas com valor definido pelo lojista.

| Área | Implementação atual |
|---|---|
| UI e navegação | Expo Router, abas Início, Relatório e Turbine seu Negócio |
| Tema | Dark/grafite com acento neon verde; componentes e cores em `constants/` e `components/` |
| Captura Android | Módulo Expo local `nubank-notification-listener`, com `NotificationListenerService` |
| Histórico | AsyncStorage, serializado localmente, com retenção de até 12 meses |
| Voz | Fluxo híbrido: fila persistente e TTS nativos Android como contingência; `expo-speech` também pode falar quando assume a reserva |
| QR Pix | `pix-utils` monta/valida BR Code; `react-native-qrcode-svg` renderiza; configuração guardada com `expo-secure-store` |
| Notificação contínua | Serviço Android em foreground, com notificação `ongoing` e `FLAG_NO_CLEAR` |
| Permissões | Acesso ao listener, sobreposição e solicitação de isenção de otimização de bateria |

O escopo inicial foi UI, tema e navegação. O projeto passou a incluir recursos nativos Android para o monitoramento real, mas ainda não há garantia de reprodução audível em toda combinação de dispositivo, fabricante, versão do Android, engine de TTS, permissões e estado de energia.

## 2. Mapa dos principais arquivos

### Aplicativo e telas

- `app/_layout.tsx`: layout raiz e configuração global do Expo Router.
- `app/(tabs)/_layout.tsx`: barra de abas e ícones; foguete da aba Turbine tem pulsação sutil.
- `app/(tabs)/index.tsx`: tela inicial, estado do monitoramento, fluxo de permissões, cobrança Pix e configuração da chave.
- `app/(tabs)/relatorio.tsx`: relatório de recebimentos.
- `app/(tabs)/turbine.tsx`: tela de promoção/recursos para negócios.
- `constants/theme.ts`: tokens do tema visual.
- `components/StatusToggle.tsx`: controle visual de ativação.
- `components/PixChargeGenerator.tsx`: entrada de valor e apresentação do QR.
- `components/PixChargeSettings.tsx`: configuração e bloqueio/desbloqueio da chave.
- `components/PermissionSetupModal.tsx`: explicação e condução pelas permissões Android.

### Serviços JavaScript/TypeScript

- `services/bankNotificationListener.ts`: parser TypeScript, ligação do listener nativo com o relatório, escolha da rota de fala, overlay e tratamento de erros.
- `services/ttsService.ts`: fila serializada de `expo-speech`, com callbacks de conclusão, interrupção e falha.
- `services/pixStorage.ts`: persistência do histórico em AsyncStorage, serialização de gravações, notificadores de UI e retenção de 12 meses.
- `services/pixChargeService.ts`: validação de chave Pix, armazenamento seguro da configuração e montagem/validação do BR Code.
- `utils/bankPixParser.ts`, `utils/pixFormatter.ts`, `utils/ttsFormatter.ts`: parsing e formatação compartilhados.

### Módulo Android local

- `modules/nubank-notification-listener/android/src/main/java/expo/modules/nubanknotificationlistener/NubankNotificationListenerService.kt`: recebe notificações Android, passa para a fila nativa e encaminha os campos ao JavaScript.
- `modules/nubank-notification-listener/android/src/main/java/expo/modules/nubanknotificationlistener/PixSpeechQueue.kt`: fila persistente, parser nativo, controle de reserva JS, TTS Android, temporizadores, retentativas e preferências.
- `modules/nubank-notification-listener/android/src/main/java/expo/modules/nubanknotificationlistener/NubankNotificationListenerModule.kt`: API Expo nativa exposta ao TypeScript, permissões, cancelamento de notificação e overlay.
- `modules/nubank-notification-listener/android/src/main/java/expo/modules/nubanknotificationlistener/PixFalaForegroundService.kt`: notificação e serviço foreground.
- `modules/nubank-notification-listener/src/NubankNotificationListener.types.ts`: contrato TypeScript do módulo nativo.
- `plugins/withNubankNotificationListener.js`: configuração Android aplicada pelo prebuild.

## 3. Fluxo atual de uma notificação Pix

O processamento tem duas trilhas relacionadas: a nativa protege o anúncio; a JavaScript registra e apresenta dados na interface.

```text
Android recebe notificação
  ├─ NotificationListenerService encaminha ao PixSpeechQueue
  │    ├─ verifica monitoramento e padrões de Pix recebido
  │    ├─ extrai valor/pagador e cria assinatura anti-duplicação
  │    ├─ grava item da fala em SharedPreferences via commit() síncrono
  │    ├─ após persistência confirmada, tenta cancelar notificação de banco suportado
  │    └─ agenda processamento TTS (aguarda confirmação JS ou janela de segurança)
  └─ emite os campos da notificação ao JavaScript
       ├─ valida recebimento/valor novamente
       ├─ reserva a fala JS na fila nativa, ou cria item nativo de contingência
       ├─ salva o Pix no histórico AsyncStorage
       ├─ confirma à fila nativa que o registro JS terminou
       ├─ dispara callback de UI e tenta exibir overlay
       └─ fala pelo expo-speech, se a reserva JS foi concedida;
          caso contrário, a fila nativa é responsável pela fala
```

**Ordem efetiva relevante:** o serviço Android tenta persistir a fala e cancelar a notificação antes de o JavaScript terminar a gravação do relatório. A fila nativa só começa a falar após `confirmPixStored()` ou depois da janela de segurança. Portanto, “notificação removida” significa que o anúncio está guardado duravelmente segundo o `commit()` local, não que o relatório JS já foi gravado nem que o áudio já foi ouvido.

Se o armazenamento JS falhar, o callback reporta erro e a fila nativa não deve ser descartada por isso; após a janela de segurança, ainda pode anunciar. Se a reserva JS for liberada por falha de fala, o processamento nativo poderá assumir. O popup/overlay é uma apresentação independente da fala e não confirma que o cliente pagou: apenas reflete a notificação recebida.

### Deduplicação

- A fila nativa identifica entradas por assinatura que inclui chave da notificação, instante, pacote e valor; mantém assinaturas tratadas por período limitado.
- O JavaScript usa `recentNotifications` em memória, por até 60 segundos, para evitar duplicação de callbacks durante a execução.
- São proteções complementares. Não se deve remover nem enfraquecer uma sem analisar como a outra compara notificações que o banco atualiza/republica.

## 4. Migração do módulo de fala: JavaScript para Android

### Como era o modelo JavaScript

O modelo original executava a leitura com `expo-speech` no runtime JS:

1. O módulo nativo notificava o JavaScript.
2. O parser TS extraía valor e pagador.
3. O app persistia o histórico em AsyncStorage.
4. `services/ttsService.ts` adicionava texto a um array JS e chamava `Speech.speak()`.
5. `onDone`/`onError` liberavam a próxima fala na fila.

Esse desenho já serializava os anúncios enquanto o runtime JS estava ativo. A fraqueza operacional era depender do ciclo de vida do processo/runtime JavaScript: suspensão, encerramento pelo Android, falha do bridge, erro de inicialização do TTS, callbacks não recebidos ou fila em memória perdida podiam interromper o anúncio. Persistir no relatório também não resolvia isso: o dado podia existir sem que uma fala pendente sobrevivesse ao processo.

O serviço TS e a fila JS **ainda existem**; portanto, a migração não removeu `expo-speech`. O fluxo atual é híbrido, com fila Android persistente e seleção/coordenação que ainda passa pelo JavaScript quando ele está disponível.

### O que foi movido para Android

`PixSpeechQueue.kt` introduziu uma fila nativa baseada em `SharedPreferences` e `TextToSpeech` do Android:

- A fila é serializada para JSON e escrita sincronamente com `SharedPreferences.Editor.commit()`.
- Cada item guarda identificador, chave e hora da notificação, pacote, valor, pagador, texto, assinatura, instante de captura, confirmação de persistência no relatório e instante de reserva JS.
- Ao conectar o `NotificationListenerService`, a fila restaura estado e tenta processar pendências.
- `TextToSpeech` é inicializado em `pt-BR`; se a voz estiver ausente/não suportada, tenta o locale padrão.
- `UtteranceProgressListener` trata conclusão, erro e interrupção.
- Falha ou timeout encerra a tentativa atual e agenda nova inicialização/tentativa; o item fica pendente enquanto não for concluído.
- Uma reserva JS evita que o TTS nativo e o Expo falem o mesmo item simultaneamente. Se a reserva expirar ou for liberada após falha, o TTS Android pode assumir.
- A fila nativa também consegue formar uma fala de contingência com os dados do parser JS quando o parser nativo não reconhece o texto.

### Coordenação JS/nativo

O contrato em `NubankNotificationListener.types.ts` expõe operações relevantes:

- `claimJavascriptSpeech(key, postTime)`: retorna `claimed`, `native-speaking`, `native-fallback` ou `not-found`.
- `enqueueJavascriptFallback(...)`: tenta gravar na fila nativa um item construído com o parser JS.
- `confirmPixStored(key, postTime)`: confirma que o fluxo JS terminou a gravação do registro.
- `completeJavascriptSpeech(key, postTime)`: reconhece conclusão do Expo Speech na fila.
- `releaseJavascriptSpeech(key, postTime)`: devolve a responsabilidade à fila nativa depois de falha JS.
- `cancelNotification(key)`: rota de cancelamento explícita usada pelo JS apenas se não houver fila nativa confirmada e a fala terminar.

`services/ttsService.ts` mantém sua própria fila sequencial em memória: `speechQueue`, `isSpeaking` e `processarFila()`. Ela protege chamadas do `expo-speech` contra sobreposição enquanto o processo JS está ativo; não é uma fila persistente e não substitui a fila Android.

### Temporizações configuradas na fila Android

Os valores estão em `PixSpeechQueue.kt` e devem ser revistos com cautela:

- `CAPTURE_STORAGE_GRACE_MS = 2_500`: período para dar chance ao fluxo JS de gravar o histórico/confirmar a fila antes do TTS nativo.
- `SPEECH_RETRY_DELAY_MS = 15_000`: espera antes de reinicializar o mecanismo após falha.
- `SPEECH_WATCHDOG_MS = 45_000`: timeout de uma tentativa de fala.
- `JAVASCRIPT_SPEECH_TIMEOUT_MS = 45_000`: expiração da reserva JS para evitar item preso sem retorno.
- Assinaturas concluídas: retenção de 24 horas, com limite de 200 entradas.

Esses tempos são políticas de recuperação, não garantias do sistema operacional. Alterá-los pode aumentar latência, duplicatas ou risco de concorrência entre motores.

### Garantias pretendidas e limites

A política pretendida é **at-least-once**: preferir repetir uma fala em um caso extremo a abandonar silenciosamente um Pix já recebido. O cancelamento da notificação bancária ocorre após a entrada passar pela gravação durável da fila nativa, não simplesmente após detectar o texto nem somente após persistir no relatório.

Isso reduz, mas não elimina, falhas:

- A confirmação de `commit()` reduz o risco de apagar uma notificação sem ter guardado uma entrada de fala; não protege contra corrupção, falha física do dispositivo, limpeza de dados ou desinstalação.
- Se o áudio já foi ouvido, mas o processo cair antes de persistir a conclusão/assinatura tratada, uma repetição após reconexão é possível.
- Se a notificação não for reconhecida pelo parser, não existe fila/fala baseada naquele parser; o parser TS pode recuperá-la se o evento chegar ao JS e tiver texto suficiente.
- Android pode revogar acesso ao listener, encerrar o processo, restringir execução em background, faltar voz pt-BR, silenciar mídia ou ter problemas de volume/rota Bluetooth.
- Não há como o app provar que uma pessoa realmente ouviu o áudio; `onDone` significa conclusão reportada pelo mecanismo, não confirmação humana/acústica.
- Cancelar uma notificação apaga a apresentação visual do banco. O conjunto de pacotes canceláveis é explícito e deve ser mantido conservador.

## 5. Cancelamento de notificações bancárias

O cancelamento automático é executado pelo callback de `PixSpeechQueue` em `NubankNotificationListenerService`, depois da persistência da fila. Só ocorre quando o `packageName` pertence ao conjunto `BANK_PACKAGES`.

Pacotes atualmente listados:

`com.nu.production`, `com.bmg.banco.mobile`, `br.com.bancobmg.bancodigital`, `com.neon`, `com.c6bank.app`, `br.com.bb.android`, `com.bradesco`, `br.com.bradesco.next`, `com.itau`, `com.itau.personnalite`, `com.santander.app`, `com.mercadopago.wallet`, `br.gov.caixa.tem`, `br.com.gft.caixa`, `br.com.intermedium`, `br.com.uol.ps`, `com.picpay`, `br.com.stone.ton`, `co.stone.pos.android`.

O parser nativo pode reconhecer texto vindo de outros pacotes, mas isso não os torna automaticamente canceláveis. Ao adicionar banco, conferir o identificador real do aplicativo instalado, sinais de recebimento versus envio, formatos de valor/pagador, parser JS, parser Kotlin e conjunto de cancelamento. Evitar cancelamento genérico de todos os apps.

## 6. Histórico, QR Pix e telas

### Histórico

`services/pixStorage.ts` armazena `PixRecord` no AsyncStorage. Cada registro inclui ID, valor, pagador, banco e timestamp, com pacote e texto bruto opcionais. As operações de escrita são enfileiradas para evitar gravações concorrentes; leitura e gravação removem registros mais antigos que 12 meses. A tela de relatório tem filtros por período (dia/semana/mês) e pesquisa por pagador/valor, conforme a implementação da tela.

### Cobrança QR

`services/pixChargeService.ts`:

- valida CPF/CNPJ e detecta telefone, e-mail e chave aleatória;
- normaliza nome e cidade do recebedor;
- persiste a configuração com `expo-secure-store`;
- monta cobrança Pix estática com `pix-utils`;
- reabre o BR Code gerado para validar chave e valor antes de retornar o payload.

`PixChargeGenerator` usa o payload na renderização de QR em tela. A chave pode ser bloqueada após salvar e desbloqueada explicitamente para alteração. A configuração é local; este fluxo não confirma liquidação de uma cobrança nem substitui validação bancária.

## 7. Riscos e próximos passos para quem continuar

### Prioridade alta: persistência atômica da conclusão da fala

Revisar `completeJavascriptSpeech()` e `complete(item)` em `PixSpeechQueue.kt`. Ambas removem o item da fila em memória antes/de forma acoplada à persistência e há chamadas a `persistQueue()` cujo retorno é ignorado. Se a conclusão da fala não for gravada com sucesso, o estado persistido pode ficar inconsistente; dependendo da ordem efetiva de gravação, há risco de repetição ou perda lógica da fila após reinício. Implementar transição atômica com rollback ou protocolo de estado que mantenha o item durável até que a conclusão e a deduplicação estejam confirmadas. Incluir falha simulada de `commit()` nos testes onde viável.

Também revisar os usos do retorno de `persistQueue()` na expiração da reserva JS e em `setMonitoringEnabled(false)`. Desativar deliberadamente pode limpar a fila, mas a decisão e o comportamento precisam ser explícitos; falha de persistência não deve virar sucesso silencioso.

### Prioridade alta: ordem de relatório versus cancelamento

O estado atual cancela após persistir a fala na fila nativa, antes de o relatório AsyncStorage confirmar o registro. Isso protege o anúncio, mas, se a gravação do relatório falhar, a notificação já pode ter sido removida. Decidir conscientemente qual dado é fonte de verdade e se a fila nativa deve carregar informação suficiente para recuperar também o registro do relatório após reinício. Não inverter a ordem para “relatório primeiro” sem preservar o caso em que o processo JS morre antes da fala.

### Testes funcionais recomendados

1. Dois ou mais Pix seguidos, de valores/pagadores diferentes: todos devem ser registrados e anunciados uma vez, em ordem.
2. Falha/recusa do `SharedPreferences.commit()`: manter notificação visível e não afirmar que o item está protegido.
3. Falha do AsyncStorage: erro visível/logado e confirmar comportamento da fila após a janela de segurança.
4. Expo Speech ocupado, interrompido, erro e ausência de callback: nativo assume sem fala simultânea.
5. Matar o processo em cada fronteira: depois da captura, depois do `commit()`, depois do cancelamento, após começar áudio e antes da conclusão persistida.
6. Notificação atualizada/agrupada, duplicada, pagamento enviado, Pix recebido, valor malformado e pagador ausente.
7. Pacote de banco mapeado e desconhecido: cancelar somente o pacote explicitamente suportado.
8. Listener desativado, permissão removida, reinicialização do serviço e boot/reconexão.
9. Android real com diferentes fabricantes, otimização de bateria, tela bloqueada, mídia silenciada e dispositivos Bluetooth.

### Validação/build

Na sessão de 08/10/2026 passaram `npx.cmd expo lint`, `npx.cmd tsc --noEmit` e `git diff --check`. `expo prebuild --platform android --no-install` gerou Android, mas a compilação `:nubank-notification-listener:compileDebugKotlin` **não foi executada**, pois não havia `JAVA_HOME` nem `java` no ambiente; o diretório `android/` gerado apenas para a tentativa foi removido. Não houve teste em dispositivo nem nova build EAS nessa validação.

Após mudanças nativas, compilar o módulo/build Android com JDK configurado e gerar uma nova build instalável: alterações Kotlin no módulo local não entram num app que já está instalado. Testar no dispositivo real antes de concluir que áudio e cancelamento estão funcionando.

## 8. Regras para mudanças futuras

- Manter parser e política de cancelamento alinhados entre Kotlin e TypeScript. Se uma notificação mudar de formato, testar ambos.
- Não cancelar antes de existir proteção persistente para o que precisa sobreviver à remoção.
- Não usar TTS concluído como condição para salvar o relatório; persistência do registro e áudio são responsabilidades distintas.
- Preferir logs com etapa, origem e resultado, sem incluir dados sensíveis completos do pagador/texto bruto em produção.
- Não alegar “nunca falha”: comunicar estado de permissões e erros e descrever a estratégia como mitigação/retry, não garantia absoluta.
- Preservar suporte apenas Android onde a implementação depende de `NotificationListenerService`; outras plataformas devem continuar com comportamento explicitamente limitado.
- Expo/React Native são versões mutáveis. Antes de alterar API nativa/Expo, conferir `package.json` e documentação da versão em uso.
