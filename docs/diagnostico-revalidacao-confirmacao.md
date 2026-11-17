# Diagnóstico das recusas de revalidação

A confirmação diferencia falhas técnicas de divergências entre a campanha aprovada e a leitura independente. Todas continuam impedindo o envio; nenhuma falha gera nova tentativa automática.

## Tempo de leitura

O padrão de `SAUDEVIANET_CAMPAIGN_SOURCE_TIMEOUT_MS` passa de 60000 para **120000 ms** para coleta e identificação da campanha. Uma configuração explícita continua prevalecendo; o intervalo aceito permanece entre 1000 e 300000 ms. Para esta entrega, usar 120000 ms. O cliente da aprovação no bridge aguarda até 180000 ms, deixando margem para a resposta do backend. Configurações acima desse orçamento exigem coordenar os demais limites antes de usar.

A interface aguarda até 300000 ms na resolução de pendências e nas operações de consulta/inclusão de novos horários: o backend pode realizar coleta e identificação independentes, de até 120000 ms cada, além da classificação. Um resultado incerto de uma operação administrativa continua sujeito à consulta de recuperação já existente, sem repetição automática da mutação.

A leitura autenticada `GET /confirmation-execution/read-configuration` informa somente o limite efetivo e se existe uma configuração explícita, sem segredos ou dados de pacientes. Usa o mesmo escopo operacional de leitura e não consulta a agenda. Conferir esse valor após publicar para detectar sobreposições antigas.

## Contrato dos motivos

`POST /confirmation-execution/campaigns/:id/items/:itemId/check` continua autenticado exclusivamente pelo escopo de leitura operacional. Em caso de recusa, `ready` permanece `false` e `dispatchEnabled` permanece `false`. O campo `reason` usa somente códigos finitos:

- Fonte: tempo excedido, erro HTTP, resposta inválida, consulta incompleta, vazia, desconectada ou indisponível.
- Aprovação e liberação: aprovação alterada, serviço sem acesso, limite de requisições, envio sem liberação ou item fora do lote.
- Destinatário: serviço indisponível, recusa das verificações obrigatórias ou referência incompatível.
- Divergência: paciente, destinatário, telefone, horário, agenda ou classificação de idade.
- Duplicidade: telefone vinculado a mais de um agendamento na campanha ou na fonte atual.

A enumeração completa fica em `src/confirmation-admin/revalidation-diagnostics.ts` e no contrato correspondente do bridge. Mensagens de exceção, URLs, corpos de resposta, telefones e os valores divergentes não são enviados como diagnóstico.

O bridge mantém o código por decisão, inclusive nas camadas de escopo e liberação, e o persiste no registro da tentativa. A sincronização encaminha códigos reconhecidos somente como evento de transporte bloqueado com pendência de análise. O backend rejeita seu uso como confirmação do paciente ou como confirmação clínica. A interface apresenta descrições em português, com tratamento neutro para códigos desconhecidos.

## Segurança e histórico

As verificações antes e depois da consulta do destinatário, a leitura independente, o controle de atendimento humano, as revogações e a conferência final do prazo permanecem obrigatórios. Leituras parciais continuam bloqueando; a correção não ignora falhas em outras agendas nem elimina a verificação de duplicidades entre agendas.

Não há cache de aprovação, repetição automática, reabertura de campanha, alteração de destinatário ou liberação de contato incerto. Um registro terminal bloqueado continua sem nova tentativa. Eventos antigos com motivo genérico não são reinterpretados, e seus identificadores idempotentes são preservados. Não há alteração de schema ou migração.

## Publicação

A publicação exige autorização específica. Ordem recomendada: backend aceitando os códigos, interface exibindo-os e bridge emitindo-os. Conferir se o ambiente possui configuração explícita do tempo e usar 120000 ms nesta entrega. Manter os envios desabilitados durante a implantação. A publicação não autoriza reiniciar um lote expirado, reenviar itens bloqueados ou habilitar confirmação clínica.

Se for necessário voltar uma versão, parar primeiro a emissão dos novos códigos no bridge; resultados ainda pendentes permanecem na fila durável. Não apagar tentativas ou resultados para contornar incompatibilidade.
