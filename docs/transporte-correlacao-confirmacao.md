# Entrega 4A — transporte e correlação

Implementação em 04/11/2026, com ativação real bloqueada. Não altera a interface
administrativa nem recria tela ou mecanismo de política de autorização.

## Contrato operacional

`GET /api/confirmation-execution/campaigns/:id` lê a revisão aprovada e referências
opacas. `POST /api/confirmation-execution/campaigns/:id/items/:itemId/check`, com
`{"revision":"<sha256>"}`, consulta novamente `AppointmentSource` e relê a revisão
após a consulta. Reabertura, coleta incompleta, telefone compartilhado, alteração
de horário ou destinatário e contato inelegível bloqueiam o item.

Ambas as rotas exigem token de serviço com `CONFIRMATION_EXECUTION_READ` e retornam
`dispatchEnabled: false`. Escopos de simulação e registro de contatos não dão esse
acesso. Não provisionamos tokens nem aplicamos migrações em banco de uso normal.
A nova migração apenas acrescenta esse escopo ao enum PostgreSQL.

A chave operacional é SHA-256 de
`confirmation:operational:v1:<campaignId>:<revision>:<itemId>`. A revisão reutiliza
exatamente o cálculo já usado pela simulação, extraído para `campaign-approval.ts`.
A simulação continua com armazenamento, finalidade e autorização separados.

No Python, `POST /internal/confirmations/recipient-by-reference` usa o token interno
exclusivo do resolvedor. Recebe data, horário e referências de agendamento,
paciente, destinatário e telefone. Faz nova coleta, correspondência HMAC única e
nova resolução independente. Só retorna telefone transitório quando todos os
vínculos e as evidências individuais permanecem válidos. IDs do legado ficam
nessa fronteira; não são enviados ao Bridge/Hermes.

## Transporte e persistência no Bridge

O adaptador operacional é uma porta separada, sem ligação ao comando de dispatch,
cron, webhook ou configuração de produção. Seu cliente HTTP padrão é fechado;
testes injetam HTTP fictício. A migração SQL 003 persiste reserva antes dos efeitos
externos, referências opacas, conta/inbox, IDs de contato/conversa/mensagem e eventos.
Não persiste telefone, source_id do contato, conteúdo da mensagem ou credenciais.

Repetição/concorrência reutiliza a reserva. Uma tentativa aceita, em andamento ou
com resultado desconhecido também impede reenvio automático após nova aprovação.
Contato/conversa são vinculados por identificador opaco; buscas não escolhem uma
pessoa por nome ou telefone. Conversa humana, encaminhamento à recepção e conversa
ativa de origem desconhecida bloqueiam a tentativa sem mudar atribuição ou status.

`accepted` registra aceite do Chatwoot; `delivery_status` é separado e só muda com
evento autenticado pelo futuro chamador. Não representa confirmação do paciente.
Timeout de escrita, resposta ambígua e falha de persistência após aceite deixam
`delivery_unknown`. Reservas interrompidas e resultados desconhecidos exigem
reconciliação explícita futura; não há retomada ou repetição automática.

Correlação exige conta, inbox e conversa exatos. Havendo mais de uma tentativa,
é necessário o ID da mensagem respondida; a conversa sozinha não escolhe horário.
O registro de eventos é idempotente. A ligação ao webhook pertence à entrega 4B.

## Canal e limites da homologação

A inspeção local consultou somente metadados: a inbox disponível é WebWidget.
Não existe canal WhatsApp local para homologação. O contrato implementado e testado
é explicitamente **Chatwoot WhatsApp Cloud**, com template UTILITY aprovado e
parâmetros de data/horário; não presume compatibilidade com outro provedor.
O adaptador consulta e valida inbox/template em tempo de execução e bloqueia
WebWidget, saudação automática, configuração inválida e template indisponível.

O formato foi conferido na documentação oficial e nos serializers da instalação
local: [contatos](https://developers.chatwoot.com/api-reference/contacts/create-contact),
[conversas](https://developers.chatwoot.com/api-reference/conversations/create-new-conversation)
e [mensagens](https://developers.chatwoot.com/api-reference/messages/create-new-message).
Não foram criados contatos, conversas nem mensagens nessa instalação.

Antes do piloto, ainda são necessários canal/provedor reais, inbox, template e
recursos compatíveis, texto final, janela de campanha e prazo de resposta. Nenhum
desses requisitos foi preenchido com dados fictícios na configuração real.
A interpretação de respostas, encaminhamentos e expiração pertence à entrega 4B;
a confirmação no Saúde Vianet é posterior e requer autorização própria.

## Validação

- Backend: 58 testes Jest aprovados dos serviços de execução, simulação, administração e fonte;
  `tsc --noEmit --incremental false -p tsconfig.build.json` com Prisma gerado em
  volume separado; todas as migrações aplicadas somente em PostgreSQL descartável.
- Bridge: `npm test` e `tsc --noEmit`; testes novos com migrações reais em PGlite,
  concorrência, resultado desconhecido, privacidade, atendimento humano,
  correlação e eventos; contrato HTTP exercitado em servidor loopback fictício.
- Python: 150 testes unittest aprovados por módulo, com `.env` desabilitado e credenciais fictícias;
  seleção opaca, alteração entre leituras, revogação, validade e responsável legal.
  Não há typechecker Python configurado; unittest não substitui essa verificação.

A validação cobre componentes e contratos isolados. Não constitui homologação de
ponta a ponta com o provedor WhatsApp da clínica. `confirmations:dispatch` continua
bloqueado; nenhum WhatsApp ou confirmação de agendamento real foi executado.
