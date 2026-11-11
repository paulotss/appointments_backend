# Confirmação de agenda sem cadastro de autorização de contato

Mudança de política solicitada e confirmada explicitamente pela clínica em
11/11/2026: o registro de autorização de contato deixa de ser requisito do fluxo
de confirmação. Não é uma conclusão jurídica nem cria fundamento ou evidência
em nome da clínica. O histórico anterior não é apagado.

## Regras operacionais

- Sem autorização cadastrada, o destinatário pode ficar apto somente se número,
  pessoa e agendamento estiverem verificados, sem ambiguidade ou falha técnica.
- Idade desconhecida, responsável legal não verificado, verificação ausente ou
  revogada e divergência de número continuam bloqueando.
- A revogação efetiva de contato de agenda por WhatsApp do destinatário continua
  bloqueando, mesmo se houver outro registro histórico vigente. Não há liberação
  implícita por novo registro de autorização.
- Ausência, expiração ou registro de outra finalidade não criam uma revogação.
  Falha ao ler ou interpretar o registro da clínica continua sendo falha técnica.
- A ausência de autorização permanece `unknown` nos metadados. Não se fabrica
  um registro ou se devolve `documented` sem uma autorização histórica real.
- Aprovação administrativa de campanha e autorização específica de envio continuam
  separadas. Dispatcher e escrita no Saúde Vianet não são habilitados por esta entrega.

A política operacional é aplicada em `saudevianet_mcp_py`: coleta/classificação,
resolução independente por referência e guard imediatamente anterior à escrita
isoladamente composta. O Bridge operacional continua consumindo os contratos
existentes; nenhum token, HMAC ou escopo de serviço é alterado.

## Campanhas existentes

A classificação das campanhas já abertas é persistida e pode conservar
`authorization_missing`. A interface passa a oferecer `Reavaliar contato` para
o paciente selecionado, sem digitar seus identificadores.

`POST /api/contact-registry/reclassify` aceita somente `patientRef` opaco e exige
ADMIN ou recepção com papel atual no banco. Tokens de serviço não executam a ação.
Reutiliza `reclassifyPatient`, atualizando somente itens daquele paciente e
preservando auditoria, verificações e autorizações históricas. Consulta e seleção
não fazem a reavaliação implicitamente. Nenhuma aprovação é criada ou renovada.
Snapshots aprovados não são modificados; o guard continua exigindo correspondência
com a revisão aprovada antes de execução. Se a campanha aprovada for afetada,
reabrir e aprovar uma nova revisão antes de qualquer execução. Falha da
classificação não promove itens.

## Implantação

Publicação, PR, merge e implantação exigem aprovação específica. Ordem:

1. Implantar o Python e verificar os contratos com fixtures, mantendo os guards.
2. Publicar o backend e verificar a nova rota protegida de reavaliação.
3. Publicar o frontend sem o formulário de autorização e seus avisos de pendência.
4. A recepção usa `Reavaliar contato` e confere os resultados nas campanhas.

Não atualizar dados clínicos por script de migração. Não reabrir ou aprovar
campanhas automaticamente. Não disparar mensagens para validar a implantação.

## Validação reproduzível

O runner nativo dispensa as imagens locais do backend, usa dependências privadas
já instaladas sob `/tmp` e confere que o Prisma gerado corresponde ao schema.
Cria PostgreSQL em tmpfs na porta 5548 e serviços fictícios somente em loopback;
não lê `.env` nem importa o AppModule de produção. Emite logs e screenshots de
fixtures, sem destinatários ou credenciais reais, e encerra os serviços ao final.

```sh
python test/run-confirmation-contact-policy.py \
  --node /caminho/node \
  --python-root /caminho/saudevianet_mcp_py \
  --frontend-root /caminho/appointments_frontend \
  --dependency-root /tmp/dependencias/node_modules \
  --playwright-module /tmp/browser-tools/node_modules/playwright/index.mjs
```

Complementar com unittest Python sem `.env`, Jest de `src/confirmation-admin`,
TypeScript sem emissão e `npm run build`, `test:contact-status` e
`test:confirmation-contact-policy` no frontend. Não há typechecker configurado
no projeto Python; análise sintática não equivale a typecheck.
