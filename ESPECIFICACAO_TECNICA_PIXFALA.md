# PixFala — especificação técnica e guia de continuidade

**Atualizado em:** 08/10/2026  
**Objetivo:** dar a outros agentes e desenvolvedores contexto suficiente para entender o app, continuar mudanças com segurança e investigar o monitoramento/anúncio de Pix.

> Este documento descreve o estado do código consultado nesta data. Ele não substitui testes em aparelho Android. Em especial, a compilação Kotlin e o fluxo real de notificações/áudio ainda precisam ser validados em um ambiente com JDK e em um dispositivo.

## 1. Visão geral

PixFala é um aplicativo Android com interface em React Native, Expo e TypeScript. O app monitora notificações financeiras, registra recebimentos Pix localmente, anuncia o recebimento por voz, pode exibir uma confirmação sobre outros apps e gera cobranças Pix estáticas com valor definido pelo lojista.

| Área | Implementação atual |
|---|---|
| UI e navegação | Expo Router, abas Início, Relatório, Configurações e Turbine seu Negócio |
| Tema | Dark/grafite com acento neon verde; componentes e cores em `constants/` e `components/` |
| Captura Android | Módulo Expo local `nubank-notification-listener`, com `NotificationListenerService` |
| Histórico | AsyncStorage, serializado localmente, com retenção de até 12 meses |
| Voz | Fila persistente e TTS nativo; beep Android de 250 ms somente em builds debug; `expo-speech` é contingência se a fila nativa não puder ser persistida |
| QR Pix | `pix-utils` monta/valida BR Code; `react-native-qrcode-svg` renderiza; chave em `expo-secure-store`; produtos salvos localmente e somados por quantidade |
| Notificação contínua | Serviço Android em foreground, com notificação `ongoing` e `FLAG_NO_CLEAR` |
| Permissões | Acesso ao listener, sobreposição e solicitação de isenção de otimização de bateria |

O escopo inicial foi UI, tema e navegação. O projeto passou a incluir recursos nativos Android para o monitoramento real, mas ainda não há garantia de reprodução audível em toda combinação de dispositivo, fabricante, versão do Android, engine de TTS, permissões e estado de energia.

Na aba Configurações, a mensagem de voz aceita os marcadores opcionais `{nome}`, `{sobrenome}` e `{valor}`, inseridos por atalhos na posição atual do cursor, além de velocidades de 1x, 1,5x e 2x. Nome e sobrenome são substituídos independentemente; omitir os marcadores significa não falar esses dados. O volume da fala pode ser alterado de 0 a 100%, em passos de 10%, e afeta somente a voz do PixFala, não o volume geral do aparelho. O controle é persistido junto à frase e velocidade: Android usa `TextToSpeech.Engine.KEY_PARAM_VOLUME` e Expo Speech usa a opção `volume`, ambos no intervalo `0.0–1.0`. Configurações antigas sem o campo volume são interpretadas como 100%. O sinal de diagnóstico Android, disponível apenas em builds debug, usa `ToneGenerator` separado e não segue este controle. A configuração é salva no Android nativo para a fala principal não depender do JavaScript; a rota Expo Speech consulta a mesma configuração. O carregamento não deve acrescentar automaticamente `{sobrenome}` a templates antigos, pois isso anula a personalização escolhida pelo lojista. Produtos (nome e preço unitário) são armazenados localmente. Na cobrança, toques em `+` adicionam unidades, `−` reduz a quantidade e o valor do QR é atualizado pela soma; digitar manualmente o valor substitui a seleção de produtos.

## 2. Mapa dos principais arquivos

### Aplicativo e telas

- `app/_layout.tsx`: layout raiz e configuração global do Expo Router.
- `app/(tabs)/_layout.tsx`: barra de abas e ícones; foguete da aba Turbine tem pulsação sutil.
- `app/(tabs)/index.tsx`: tela inicial com marca, monitoramento, cobrança QR Pix com atalhos de produtos, captura e licença.
- `app/(tabs)/configuracoes.tsx`: chave Pix, personalização da fala e cadastro/edição/exclusão de produtos.
- `app/(tabs)/relatorio.tsx`: relatório de recebimentos.
- `app/(tabs)/turbine.tsx`: tela de promoção/recursos para negócios.
- `constants/theme.ts`: tokens do tema visual.
- `components/StatusToggle.tsx`: controle visual de ativação.
- `components/PixChargeGenerator.tsx`: entrada de valor e apresentação do QR.
- `components/PixChargeSettings.tsx`: configuração e bloqueio/desbloqueio da chave.
- `services/speechSettingsService.ts`: frase, velocidade e volume da fala; Android usa SharedPreferences nativas para que a fila funcione sem runtime JS.
- `services/savedProductsService.ts`: persistência e validação local do catálogo de produtos.
- `components/PermissionSetupModal.tsx`: explicação e condução pelas permissões Android.

### Serviços JavaScript/TypeScript

- `services/bankNotificationListener.ts`: parser TypeScript, ligação do listener nativo com o relatório, escolha da rota de fala, overlay e tratamento de erros.
- `services/ttsService.ts`: fila serializada de `expo-speech`, com callbacks de conclusão, interrupção e falha.
- `services/pixStorage.ts`: persistência do histórico em AsyncStorage, serialização de gravações, notificadores de UI e retenção de 12 meses.
- `services/pixChargeService.ts`: validação de chave Pix, armazenamento seguro da configuração e montagem/validação do BR Code.
- `utils/bankPixParser.ts`, `utils/pixFormatter.ts`, `utils/ttsFormatter.ts`: parsing e formatação compartilhados.

### Módulo Android local

- `modules/nubank-notification-listener/android/src/main/java/expo/modules/nubanknotificationlistener/NubankNotificationListenerService.kt`: recebe notificações Android, passa para a fila nativa e encaminha os campos ao JavaScript.
- `modules/nubank-notification-listener/android/src/main/java/expo/modules/nubanknotificationlistener/PixSpeechQueue.kt`: fila persistente, parser nativo, TTS Android imediato, temporizadores, retentativas e preferências.
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
  │    ├─ emite um sinal curto assim que a fila está persistida
  │    ├─ após persistência confirmada, tenta cancelar notificação de banco suportado
  │    └─ inicia o TTS nativo assim que o mecanismo está pronto
  └─ emite os campos da notificação ao JavaScript
       ├─ valida recebimento/valor novamente
       ├─ garante um item na fila nativa se o parser nativo não reconheceu a notificação
       ├─ salva o Pix no histórico AsyncStorage com ID idempotente
       ├─ confirma ao diário nativo que o relatório local foi salvo
       ├─ dispara callback de UI e tenta exibir overlay
       └─ usa expo-speech somente se não foi possível persistir a fala na fila nativa
```

**Ordem efetiva relevante:** o serviço Android persiste a entrada, emite o sinal curto e tenta cancelar a notificação bancária sem esperar o JavaScript. O item fica no diário nativo até que tanto o áudio como a gravação do relatório estejam confirmados; se o JS/AsyncStorage falhar ou o processo fechar, o relatório pendente pode ser sincronizado quando o app voltar. A confirmação visual permanece independente. “Notificação removida” significa que a entrada ficou guardada duravelmente localmente, não que o relatório JS já foi gravado nem que o áudio foi ouvido. Os logs medem envio/início do TTS sem registrar valor ou nome de pagador.

Se o armazenamento JS falhar, o callback reporta erro, mas o diário nativo retém a entrada até que possa ser sincronizada. A gravação do relatório usa o ID do evento Pix como chave idempotente, permitindo registrar recebimentos distintos mesmo quando chegam agrupados na mesma notificação, sem duplicar uma tentativa repetida. Se a fila nativa não puder ser persistida, o JS tenta anunciar com `expo-speech`; a notificação bancária só é limpa automaticamente se o item nativo ficou durável. O popup/overlay não confirma diretamente a liquidação: reflete a notificação recebida.

### Deduplicação

- A fila nativa usa um ID determinístico por evento, derivado da chave, pacote, texto, valor e pagador. Em notificações agrupadas, mantém o ID da mesma linha estável entre atualizações e distingue linhas idênticas por ocorrência; em notificações simples, inclui o instante do evento.
- O JavaScript deduplica somente o mesmo `eventId` por até 60 segundos. Não descarta eventos diferentes apenas por terem título/corpo iguais.
- Notificações com `EXTRA_TEXT_LINES` são examinadas linha a linha; cada Pix reconhecido é persistido e encaminhado ao relatório com seu próprio ID.
- O reconhecimento aceita recebimentos identificados por “Pix recebido” e por “Transferência recebida” (incluindo “Recebemos sua transferência”), desde que haja indicação de entrada, valor válido e origem em pacote bancário suportado.
- Eventos repetidos com a mesma chave e instante, sem distinção de conteúdo/linha fornecida pelo app bancário, não podem ser separados com certeza. O PixFala só consegue enfileirar transações que o Android efetivamente entrega ao listener.

## 4. Migração do módulo de fala: JavaScript para Android

### Como era o modelo JavaScript

O modelo original executava a leitura com `expo-speech` no runtime JS:

1. O módulo nativo notificava o JavaScript.
2. O parser TS extraía valor e pagador.
3. O app persistia o histórico em AsyncStorage.
4. `services/ttsService.ts` adicionava texto a um array JS e chamava `Speech.speak()`.
5. `onDone`/`onError` liberavam a próxima fala na fila.

Esse desenho já serializava os anúncios enquanto o runtime JS estava ativo. A fraqueza operacional era depender do ciclo de vida do processo/runtime JavaScript: suspensão, encerramento pelo Android, falha do bridge, erro de inicialização do TTS, callbacks não recebidos ou fila em memória perdida podiam interromper o anúncio. Persistir no relatório também não resolvia isso: o dado podia existir sem que uma fala pendente sobrevivesse ao processo.

O serviço TS e a fila JS **ainda existem** para contingência; a rota principal não espera o runtime JavaScript. Se a persistência da fila nativa falhar, o JS tenta falar pelo `expo-speech`.

### O que foi movido para Android

`PixSpeechQueue.kt` introduziu uma fila nativa baseada em `SharedPreferences` e `TextToSpeech` do Android:

- A fila e as assinaturas concluídas são serializadas para JSON e gravadas juntas com `SharedPreferences.Editor.commit()`.
- Cada item guarda identificador, chave e hora da notificação, pacote, valor, pagador, texto, assinatura, instante de captura e estados de fala/relatório.
- Ao conectar o `NotificationListenerService`, a fila restaura estado e tenta processar pendências.
- A frase configurável e o fator de velocidade são lidos das preferências nativas no momento de cada anúncio; `{nome}` (primeiro nome) e `{sobrenome}` são substituídos separadamente, são opcionais, e placeholders desconhecidos são preservados como texto. Espaços duplos e espaços antes da pontuação são normalizados depois da substituição.
- `TextToSpeech` é inicializado em `pt-BR`; se a voz estiver ausente/não suportada, tenta o locale padrão.
- `UtteranceProgressListener` trata conclusão, erro e interrupção.
- Um sinal curto em `STREAM_NOTIFICATION` é enviado após a persistência da fila; o TTS de voz continua em sequência e pode começar mais tarde conforme o mecanismo do aparelho.
- Falha ou timeout encerra a tentativa atual e agenda nova inicialização/tentativa; o item fica pendente enquanto não for concluído.
- O TTS nativo é o único mecanismo para itens persistidos na fila. A API `ensurePixSpeechQueued(...)` permite que o JS acrescente à fila uma notificação reconhecida apenas pelo parser TypeScript, evitando fala duplicada.
- O JS só usa `expo-speech` quando não consegue persistir o item na fila nativa.
- `getPendingPixReports()` e `markPixReportStored(...)` permitem retomar gravações pendentes; a entrada só é removida após fala e relatório confirmados.
- O texto atual nos dois mecanismos começa com “Pix recebido de [valor por extenso] de [pagador]” e termina com uma variação curta escolhida aleatoriamente: “Muito obrigado.”, “Obrigado!”, “Um ótimo dia!”, “Volte sempre!” ou “Até logo!”. Os itens persistidos antes desta alteração podem manter o texto antigo até serem processados.

### Coordenação JS/nativo

O contrato em `NubankNotificationListener.types.ts` expõe operações relevantes:

- `ensurePixSpeechQueued(...)`: garante um item durável na fila nativa, usando os dados do parser JS quando necessário.
- `getPendingPixReports()` / `markPixReportStored(eventId)`: sincroniza o relatório local a partir do diário nativo e confirma a gravação idempotente por evento Pix.
- `cancelNotification(key)`: rota de cancelamento explícita usada pelo JS se a fila nativa não puder ser persistida e a fala Expo terminar.

`services/ttsService.ts` mantém sua própria fila sequencial em memória: `speechQueue`, `isSpeaking` e `processarFila()`. Ela protege chamadas do `expo-speech` contra sobreposição enquanto o processo JS está ativo; não é uma fila persistente e não substitui a fila Android.

### Temporizações configuradas na fila Android

Os valores estão em `PixSpeechQueue.kt` e devem ser revistos com cautela:

- `SPEECH_RETRY_DELAY_MS = 15_000`: espera antes de reinicializar o mecanismo após falha.
- `SPEECH_WATCHDOG_MS = 45_000`: timeout de uma tentativa de fala.
- Assinaturas concluídas: retenção de 24 horas, com limite de 200 entradas.

Os tempos de retry/watchdog são políticas de recuperação, não garantias do sistema operacional. O áudio não aguarda mais o salvamento do relatório JavaScript.

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

`services/savedProductsService.ts` persiste produtos no AsyncStorage e valida os dados carregados. A seleção de produtos é temporária na tela de cobrança: cada unidade multiplica o preço salvo e o total preenche o mesmo campo de valor editável usado pelo QR.

### Cobrança QR

`services/pixChargeService.ts`:

- valida CPF/CNPJ e detecta telefone, e-mail e chave aleatória;
- normaliza nome e cidade do recebedor;
- persiste a configuração com `expo-secure-store`;
- monta cobrança Pix estática com `pix-utils`;
- reabre o BR Code gerado para validar chave e valor antes de retornar o payload.

`PixChargeGenerator` usa o payload na renderização de QR em tela. A chave pode ser bloqueada após salvar e desbloqueada explicitamente para alteração. A configuração é local; este fluxo não confirma liquidação de uma cobrança nem substitui validação bancária.

## 7. Riscos e próximos passos para quem continuar

### Prioridade alta: falhas de commit e entrega exatamente uma vez

A fila e as assinaturas concluídas agora são gravadas juntas em um único `commit()`. Se um commit de conclusão falha, o item permanece no diário em memória, mas uma interrupção do processo antes de nova gravação ainda pode causar repetição após reinício; não há garantia de áudio exatamente uma vez diante de encerramento abrupto do Android. Incluir falha simulada de `commit()` nos testes onde viável.

Desativar o monitoramento encerra anúncios pendentes, mas preserva entradas cujo relatório ainda não foi confirmado. Validar também falha de commit nesse caminho.

### Prioridade alta: ordem de relatório versus cancelamento

O estado atual cancela após persistir a fala na fila nativa, antes de o relatório AsyncStorage confirmar o registro. Isso protege o anúncio, mas, se a gravação do relatório falhar, a notificação já pode ter sido removida. Decidir conscientemente qual dado é fonte de verdade e se a fila nativa deve carregar informação suficiente para recuperar também o registro do relatório após reinício. Não inverter a ordem para “relatório primeiro” sem preservar o caso em que o processo JS morre antes da fala.

### Testes funcionais recomendados

1. Cinco ou mais Pix em sequência rápida, inclusive notificações com texto repetido e notificações agrupadas em `EXTRA_TEXT_LINES`: todos os eventos que o Android entregar devem ser registrados e anunciados uma vez, em ordem.
2. Falha/recusa do `SharedPreferences.commit()`: manter notificação visível e não afirmar que o item está protegido.
3. Falha do AsyncStorage: erro visível/logado, sem atrasar nem descartar o anúncio nativo.
4. Falha ao persistir a fila nativa: Expo Speech assume; falha no mecanismo nativo deve manter retry sem duplicar a fala.
5. Matar o processo após o `commit()`, após cancelar a notificação e antes/depois da gravação do relatório: recuperar o registro uma vez ao abrir o app.
6. Nubank com título “Transferência recebida” e corpo “Recebemos sua transferência de R$ ...”, sem a palavra Pix; testar também “Você recebeu uma transferência de R$ ...”, Neon com “Pix recebido”, notificação atualizada/agrupada, duplicada, Pix enviado, pontuação final (`R$ 0,01.`), espaços não separáveis, valor malformado e pagador ausente.
7. Pacote de banco mapeado e app desconhecido: só reconhecer/cancelar pacotes explicitamente suportados.
8. Listener desativado, permissão removida, reinicialização do serviço e boot/reconexão.
9. Android real com diferentes fabricantes, otimização de bateria, tela bloqueada, mídia silenciada e dispositivos Bluetooth.

### Validação/build

Após mudanças nativas, compilar o módulo/build Android e gerar uma nova build instalável: alterações Kotlin no módulo local não entram num app que já está instalado. O beep de 250 ms é apenas diagnóstico em builds debug; builds de produção não criam nem reproduzem esse sinal. Testar em dispositivo real, pois o sinal enviado ao sistema não garante volume audível se o fluxo estiver silenciado.

## 8. Regras para mudanças futuras

- Manter parser e política de cancelamento alinhados entre Kotlin e TypeScript. Se uma notificação mudar de formato, testar ambos.
- Não cancelar antes de existir proteção persistente para o que precisa sobreviver à remoção.
- Não usar TTS concluído como condição para salvar o relatório; persistência do registro e áudio são responsabilidades distintas.
- Preferir logs com etapa, origem e resultado, sem incluir dados sensíveis completos do pagador/texto bruto em produção.
- Não alegar “nunca falha”: comunicar estado de permissões e erros e descrever a estratégia como mitigação/retry, não garantia absoluta.
- Preservar suporte apenas Android onde a implementação depende de `NotificationListenerService`; outras plataformas devem continuar com comportamento explicitamente limitado.
- Expo/React Native são versões mutáveis. Antes de alterar API nativa/Expo, conferir `package.json` e documentação da versão em uso.
