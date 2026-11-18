# Recuperar a consulta parcial de uma campanha

Uma aprovação administrativa não transforma uma consulta parcial em completa.
A execução e a liberação continuam exigindo consulta READY e revalidação fresca.

O comando existente de resolver pendências, aplicado à campanha inteira em
revisão, passa a atualizar também o estado da consulta após uma leitura completa
da origem e do registro de contatos, sem falhas técnicas. É uma recuperação
com prova atual, não uma alteração manual de estado nem dispensa de evidência.
Reavaliação de apenas um item não declara recuperada a consulta global.

Preservam-se IDs, registros originais de falhas, eventos e auditoria; não são
incluídos agendamentos descobertos nessa leitura. Novos itens continuam sendo
consultados e incluídos explicitamente pela recepção. Uma consulta agora vazia
permanece bloqueada para execução. Os marcadores de falha anteriores são história
e não viram destinatários aptos.

A revisão precisa estar editável. Aprovação concorrente ou mudança de revisão
bloqueia a atualização. Após recuperar a consulta, conferir os itens e aprovar
novamente; a aprovação e a liberação anteriores não são reutilizadas. Não há
envio, escrita clínica, criação de verificação ou autorização neste comando.

Operação: reabrir a revisão, resolver pendências da campanha inteira, aguardar
consulta completa e revisar o resultado. Somente depois aprovar novamente e
liberar explicitamente os itens desejados. Se a origem continuar parcial ou o
registro falhar, nenhuma alteração é aplicada e os envios permanecem bloqueados.

A leitura operacional protegida `read-configuration` informa
`partialConsultationRecoverySupported: true` para conferir a versão implantada
sem alterar campanhas ou consultar pacientes. O escopo permanece exclusivo
de execução em leitura; não concede acesso administrativo nem envio.
