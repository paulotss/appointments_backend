# Inclusão de novos agendamentos em campanha existente

A atualização de pendências não acrescenta horários. A nova consulta administrativa
GET /confirmation-campaigns/:id/new-appointments devolve somente itens ausentes,
com identidade visual, revisão da campanha e impressão dos dados consultados.
Não grava, não cria permissões e não concede elegibilidade.

POST /confirmation-campaigns/:id/include-appointments recebe revision,
sourceRevision e appointmentRefs selecionadas. O servidor exige funcionário atual,
campanha editável e fonte completa com registro disponível; consulta novamente a
origem, compara os dados, adquire o bloqueio da campanha e verifica a revisão.
Adiciona somente itens escolhidos que ainda não existem, recalcula as contagens e
registra auditoria. Não apaga nem modifica os itens anteriores, respostas ou snapshots.

Mudança de paciente, contato, estado de elegibilidade ou conjunto de novos horários
invalida a conferência. Identificadores repetidos, antigos, inexistentes, seleção
vazia e campos manuais adicionais são recusados. Resultado incerto deve ser
conferido por GET; uma repetição da mesma requisição usa revisão obsoleta e é recusada.

Reabrir uma campanha invalida a aprovação anterior. Depois da inclusão, revisar o
prazo e aprovar novamente. A nova revisão exige refazer a restrição técnica do lote
e sua liberação operacional. Nenhum envio ou confirmação clínica é habilitado.
Não são criadas verificações, responsáveis legais ou autorizações fictícias.

Validação usa fixtures, incluindo inclusão pelo navegador com backend e banco reais
descartáveis. Não há migração de schema nesta alteração.
