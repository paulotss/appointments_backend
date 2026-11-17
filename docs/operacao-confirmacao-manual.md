# Liberação operacional de campanhas manuais

Criação, consulta da agenda e aprovação administrativa continuam manuais.
A liberação de envios é uma ação explícita, autenticada como recepção/admin,
separada da aprovação. Ela fixa revisão e IDs selecionados, com versão concorrente
e auditoria persistente. Contato elegível é validado pelo servidor; a interface
não pode promover itens pendentes. A leitura CLINIC_REGISTRY_READ não grava liberações.

GET /confirmation-campaigns/:id/send-release retorna o estado e os itens selecionáveis.
POST no mesmo endereço recebe {revision, version, itemIds}; POST /pause recebe
{revision, version}. Uma versão antiga falha sem sobrescrever a decisão de outro
operador. Cada ação registra o operador e a seleção em confirmation_send_release_events.
As tabelas são separadas dos eventos da campanha para não alterar a revisão aprovada.

A rotina lê GET /confirmation-send-queue com CONFIRMATION_EXECUTION_READ, e consulta
POST /confirmation-send-queue/:id/items/:itemId/permit com {revision} antes e depois
da resolução independente do destinatário. A fila não é uma permissão de envio:
exigem-se liberação vigente, allowlist técnica, flags de envio e janela regular.
A resposta pode permanecer dispatchEnabled=false nos contratos administrativos e
nos snapshots de evidência: eles não concedem a capacidade técnica de enviar.

Revisão alterada, prazo expirado, coleta indisponível e pausa impedem novos envios.
Pausa não desfaz chamadas externas já iniciadas e não interrompe respostas existentes.
A autorização clínica continua baseada na resposta verdadeira persistida e nas
validações originais; a liberação de envio não cria uma confirmação clínica.

Aplicar a migração antes de implantar consumidores. Não há criação automática de
campanhas, habilitação de flags, envio real ou alteração de agenda nesta entrega.
Modelos de timer e instruções de operação ficam no agent-bridge em
ops/higia-confirmation-dispatch.* e docs/confirmation-regular-operation.md.
