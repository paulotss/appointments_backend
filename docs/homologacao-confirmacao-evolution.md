# Homologação da confirmação de agenda — 10/11/2026

A etapa isolada passou e a integração conectada foi verificada somente por
metadados. Isso não autoriza envios, não confirma agendas reais e não constitui
homologação de recibos ou de respostas pelo WhatsApp da clínica.

## Ambiente efetivo

- Higia backend/frontend publicados no Render; MCP sincronizado no servidor com
  `aa05b34`. A alteração local pré-existente em `bruto.json` foi preservada.
- Evolution `higia-clinica` conectada, conta Chatwoot 1/inbox 2 e callback assinado.
  GPTMaker foi mantido a pedido da clínica. O recebimento já foi observado pelo
  usuário; não foi necessário criar uma mensagem real de teste.
- Atendimento geral da Higia IA bloqueado na inbox 2 por política de inbox; sem
  Agent Bot, saudação, distribuição automática ou regras automáticas de conta.
- Encaminhamento manual e automático do receptor continuam desativados. Os
  serviços Python continuam com escrita real desativada. Não foram criadas
  autorizações, contatos fictícios ou campanhas no ambiente clínico.

## Resultado

| Verificação | Evidência | Resultado |
|---|---|---|
| Elegibilidade, titularidade, revogação, responsável legal e falhas técnicas | Suítes Python/backend com fixtures | Passou |
| Aprovação imutável e escopos separados | Nest/Auth e PostgreSQL descartável | Passou |
| Resposta explícita, conflito, prazo e preservação do atendimento humano | Suíte Bridge com canal fictício | Passou |
| Evidência persistida antes da escrita e revalidação independente | Runner integrado com Python e legado simulado | Passou |
| Perda de resposta após escrita e reconciliação | Uma escrita simulada; recuperação por leitura sem segunda escrita | Passou |
| Separação entre resposta do paciente e estado do legado | Chromium e APIs autenticadas sobre fixtures | Passou |
| Sessão, inbox, callback e integração Evolution | Adaptador real; três GETs permitidos, sem contato/conversa/mensagem | Passou |
| Configuração operacional e migrations do Bridge | Preview inativo e banco exclusivo de homologação, fila vazia | Passou |
| Entrega/recibo, resposta citada e isolamento do GPTMaker no piloto | Nenhum envio real autorizado nesta etapa | Pendente |
| Migrations/backend e coleta de agenda no ambiente clínico | Sem leitura de pacientes nem acesso SQL ao banco Render | Não verificadas nesta etapa |
| Escrita real no Saúde Vianet | Bloqueada | Não executada |

## Correção encontrada

A Evolution 2.3.7 usa `autoCreate` apenas no comando de configuração; não persiste
nem devolve esse campo em `chatwoot/find`. O adaptador exigia `false` explícito e
bloqueava uma integração válida. A correção aceita campo ausente ou `false` e
continua recusando `true`, `null`, outra inbox/callback, sessão fechada, importações,
fusão de contatos e assinatura automática de texto. O preflight com o contrato
real passou após a correção. Ela está na branch de homologação, ainda sem push.

## Preview preparado no servidor

O Bridge ativo não foi substituído. Há um release isolado em
`/opt/higia-chat/releases/confirmation-homologation-preview-20261110`.

Arquivos privados (0600), fora do Git, em
`/home/seraphis/.config/higia-confirmations`:

- `confirmation-bridge.preview.env`: modo observe, envio/escrita false, lista de
  campanhas vazia, credenciais existentes de mesma finalidade e token Evolution
  restrito à instância. Texto é somente proposta fictícia, não aprovado para envio.
- `confirmation-database.preview.env`: credenciais novas do banco exclusivo de
  homologação; não são as credenciais do Higia ou do banco da Evolution.
- `confirmation-preview.compose.yaml`: somente PostgreSQL em loopback 5544,
  banco `confirmation_bridge_homologation`, limite de 512 MiB e uma CPU.
- `observation-service.preview.conf`: proposta de unidade fora do systemd; não
  foi ativada. Preserva os EnvironmentFiles originais do Bridge.

O banco novo recebeu apenas migrations Bridge e permaneceu com fila vazia.
Nenhum listener, cron, recuperação de fila ou dispatcher operacional foi iniciado.
O runtime de observação ainda precisa de publicação/ativação específicas. Não
substituir a configuração clínica pela configuração de fixtures do runner.

## Reprodução sem pacientes

O runner descrito em `docs/confirmacao-legado.md` continua sendo a reprodução
integrada: banco descartável, credenciais fictícias, ambiente sem dotenv, relógio
injetado e cliente de legado simulado. Ele remove processos, banco e sessões em
finally. O banco preview do servidor é separado e foi preservado intencionalmente.

No repositório higia-chat, os novos comandos são:

```sh
node --import tsx evolution/check-channel-readiness.mts \
  --config-directory /home/seraphis/.config/higia-confirmations \
  --bridge-env /opt/higia-chat/secrets/agent-bridge.env \
  --callback-env /home/seraphis/higia-evolution/callback.production.env

node --import tsx evolution/validate-confirmation-preview.mts \
  /home/seraphis/.config/higia-confirmations/confirmation-bridge.preview.env
```

Usar o loader/dependências do release no servidor, conforme o ambiente instalado.
O primeiro comando impõe uma allowlist de três GETs e imprime apenas estados. O
segundo recusa outro banco, modo ativo, envio/escrita habilitados ou campanha
permitida; compõe o runtime sem I/O externo, aplica migrations somente no banco
exclusivo e exige fila vazia. Nenhum dos dois inicia HTTP ou processa mensagens.

## Validação consolidada

- Python: 583 unittest aprovados com dotenv desabilitado e fixtures. Não existe
  typechecker Python configurado.
- Backend: 81 Jest em sete suítes aprovados; TypeScript sem emissão aprovado.
- Bridge: 431 testes aprovados, três integrações opcionais ignoradas; TypeScript
  sem emissão aprovado. Treze testes Python dos utilitários/infraestrutura passaram.
- Preflights novos: typecheck aprovado localmente e no servidor; validação de
  metadados usando token da própria instância e migrations idempotentes aprovadas.
- Frontend: build com TypeScript e quatro testes de situação de autorização
  aprovados. Permanece o aviso de bundle acima de 500 kB.
- Runner integrado e Chromium: passaram. Não houve mensagem real, coleta de
  pacientes, escrita no legado real ou alteração do banco Higia de produção.

## Próxima etapa acompanhada

1. Revisar/publicar as correções locais consolidadas de callback, recepção humana,
   CORS e o contrato Evolution, sem mudar flags de envio/escrita.
2. Ativar somente observação, usando o banco dedicado e configuração revisada.
   Validar autenticação e schema do ambiente clínico sem retornar dados pessoais;
   investigar qualquer falha antes de selecionar uma agenda real.
3. Definir texto, prazo e celular de equipe com titularidade e autorização reais
   verificadas. Não derivar elegibilidade do simples fornecimento do número.
4. Definir como o GPTMaker ficará excluído das conversas de homologação ou pausado
   durante a janela acompanhada. Conexão dupla não isola respostas automaticamente.
5. Somente após autorização explícita para um envio limitado, validar recibo,
   resposta citada, reinício e reconciliação do canal. Essa etapa não autoriza
   confirmar agendamentos reais no Saúde Vianet ou ampliar a campanha.

A alteração de flags ou a aprovação administrativa de campanha não substitui
verificação individual nem autorização específica de envio. Manter revalidação
independente imediatamente antes de qualquer futura tentativa.
