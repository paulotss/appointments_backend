# Confirmação observada após bloqueio pré-escrita

Uma tentativa pode ser bloqueada antes da escrita por falha técnica. Se uma
retomada explícita e auditada confirmar o agendamento, o produtor publica uma
reconciliação de leitura com `appointmentStatus=confirmed`. O backend aceita a
observação a partir de `blocked` ou `indeterminate`, mantendo o evento anterior.

Continuam obrigatórios a resposta anterior confirmada, o transporte aceito, o
escopo CONFIRMATION_RESULTS_WRITE, a seleção vinculada ao snapshot aprovado,
a sequência e o canal corretos e a confirmação observada sem motivo pendente.
Resultados comuns de `appointment` não podem sobrescrever um bloqueio; respostas
aguardando/humanas, recusas e vínculos diferentes não permitem a promoção.
CLINIC_REGISTRY_READ continua sem permissão de escrita.

Essa atualização somente sincroniza o estado administrativo observado: não
confirma no Saúde Vianet, não envia WhatsApp, não cria autorização de contato e
não descarta a auditoria ou pendências históricas. A retomada física permanece
uma capacidade separada, explícita, restrita e sem repetição de resultados
incertos. Não há migration nem alteração de credenciais ou contrato JSON.

A publicação do backend permite ao produtor entregar o evento já preservado na
outbox. Não apagar ou reescrever o evento para contornar a validação anterior.
