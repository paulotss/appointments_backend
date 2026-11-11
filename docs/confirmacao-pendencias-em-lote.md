# Pendências em lote e atualização de referências

## Operação administrativa

`POST /api/confirmation-campaigns/:id/resolve-pending` atualiza e reavalia os
agendamentos existentes de uma campanha editável. Corpo `{}` reavalia todos;
`{ "itemId": ID }` limita a ação ao item da própria campanha. A rota exige
ADMIN/recepção atuais; tokens de serviço não executam essa escrita. Campos que
pretendam informar verificação ou elegibilidade pelo cliente são recusados.

A fonte `AppointmentSource` é relida para a data existente. Coleta parcial,
indisponível ou registro não pronto abortam a operação sem atualizar a campanha.
A operação não digita telefones, não resolve HMAC pela máscara e não cria registros
de verificação, autorização ou responsabilidade legal.

Somente os agendamentos já presentes são atualizados. IDs dos itens e histórico
são preservados; novos horários não são incluídos. Dados da fonte são normalizados
e validados. Falta de referência pode ser recuperada desse mesmo agendamento.
Mudança de paciente/destinatário bloqueia o item, sem reassociação automática.
Agendamento que deixou de aparecer também fica indisponível, sem ser apagado.

Apto depende da classificação conclusiva da origem, motivo `contact_ready`,
referências completas, idade conhecida e resolução compatível. Pendências que
exigem conferência humana continuam bloqueadas. Um contato anteriormente apto
pode voltar a pendente se houver revogação. Linhas de falha de consulta não são
tratadas como agendamentos nem apagadas por essa operação.

A gravação usa transação e bloqueio da campanha. A revisão é conferida novamente
após a leitura da origem. Aprovação ou edição concorrente impedem gravar um
resultado antigo. Snapshots aprovados não são alterados. Eventos e auditoria são
gravados somente quando há mudanças; repetição com os mesmos dados é sem efeito.

O retorno contém a campanha e contagens: avaliados, atualizados, resolvidos,
ainda bloqueados e referências recuperadas. `dispatchEnabled` continua falso.
Nenhum dispatcher, serviço de envio ou escrita no Saúde Vianet é habilitado.

## Formulário

O botão Salvar deixa de ficar silenciosamente desabilitado por falta da
referência do número. A validação explica o impedimento e a interface oferece
atualização do mesmo agendamento. Isso não permite registrar uma verificação
sem referência válida ou sem identificar o destinatário.

Requests de leitura/escrita têm prazo e não são repetidos automaticamente.
Gravação incerta é consultada antes de qualquer novo registro. Atualização da
tela após gravação concluída repete apenas GET. Campos de uma operação incerta
ficam preservados. Mudança da referência recebida reinicia a conferência.

## Validação e implantação

Jest e TypeScript sem emissão no backend; build, testes de utilitários e
homologações Playwright no frontend. Integração UI/Nest/Python com PostgreSQL
em tmpfs e dados fictícios pelo runner já existente. Nenhum dado clínico é
necessário para validar os fluxos.

Publicar backend antes da interface, após aprovação específica. Não executar a
ação em dados reais durante a implantação. A recepção decide quando reavaliar
uma campanha; aprovação e envio continuam separados.
