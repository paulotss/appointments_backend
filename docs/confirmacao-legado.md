# Confirmação no legado — homologação isolada

Entrega de 10/11/2026. Liga uma manifestação explícita e inequívoca de confirmação
à fronteira interna do Saúde Vianet e publica o resultado no Higia. Não ativa o
dispatcher, não envia WhatsApp e não modifica agendamentos reais.

## Comportamento

- O Bridge só cria a tarefa quando recebe confirmação sem bloqueios, vinculada à
  aprovação e a uma tentativa aceita. Alteração, resposta tardia, ambiguidade,
  atendimento humano, entrega falha e transporte desconhecido não iniciam escrita.
- Antes da tentativa, relê contexto humano, conflitos posteriores, prazo e
  elegibilidade. A composição exige a porta `AppointmentConfirmer` explicitamente;
  a inicialização padrão continua sem ativação operacional.
- A migração Bridge 005 persiste tarefa e resultado. Reserva indeterminação antes
  de cruzar a fronteira de escrita. Reinício ou falha após a escrita não repetem a
  operação. Resultado e eventos seguem pela fila de saída existente, em sequência.
- A API Python recebe referências opacas, execução e evento de resposta. Faz
  coleta nova, correspondência HMAC única e revalidação independente da aprovação,
  horário e contato, inclusive imediatamente antes do POST. Reutiliza o cliente
  legado existente; somente a releitura de estado confirmado prova sucesso.
- O journal Python persiste hashes e resultados, recusa mudança do corpo na mesma
  execução e bloqueia repetição do agendamento em outra revisão. Não armazena
  telefone ou IDs do legado. Os tokens e chaves existentes não foram alterados.

## Contrato e interface

`POST /api/confirmation-results` preserva o escopo exclusivo existente. O novo
`kind=appointment` exige `appointmentStatus`: `confirmed`, `already_confirmed`,
`blocked`, `refused` ou `indeterminate`. Sucesso exige manifestação anterior
`responseStatus=confirmed` e transporte aceito. O resultado não pode substituir
silenciosamente um resultado terminal diferente.

Eventos históricos permanecem compatíveis. A nova coluna `appointment_status`
inicia em `not_requested`; eventos de transporte ou resposta não a apagam.
Falhas criam pendências internas `appointment_blocked`, `appointment_refused` e
`appointment_indeterminate`, sem mensagem automática ao destinatário.

A interface separa a resposta do paciente da situação no Saúde Vianet. Reconhece
também `already_confirmed` e resultado desconhecido, sem apresentar a manifestação
do paciente como prova de escrita no legado.

A homologação também revelou e corrigiu a comparação de horários da seleção:
`08:00` e `08:00:00` são equivalentes; `08:00:30` continua bloqueado. Isso mantém
a normalização administrativa compatível com a fonte Python, sem ignorar uma
alteração efetiva nos segundos.

## Reprodução

Pré-requisitos: Fedora WSL, Docker, Node e dependências dos projetos disponíveis,
venv Python e, para navegador, Playwright e Chromium já instalados. O runner não
instala pacotes nem carrega `.env` da clínica.

```sh
python3 test/run-confirmation-legacy.py \
  --node /caminho/para/node \
  --python-root /caminho/para/saudevianet_mcp_py \
  --bridge-root /caminho/para/higia-chat/agent-bridge \
  --frontend-root /caminho/para/appointments_frontend \
  --playwright-module /caminho/para/playwright/index.mjs
```

As duas últimas opções são opcionais. Portas fixas exclusivas: PostgreSQL 5553,
API Nest 3113, Python 8879 e Vite 5183, todas em loopback. Porta ocupada bloqueia a
execução. O banco é `confirmation_legacy_fixture`, com armazenamento descartável.
Prisma é gerado em cópia privada; builds, tokens fictícios, registros e sessões
ficam no diretório temporário. O runner remove processos, container, banco e
arquivos temporários em `finally`. Não usa AppModule, clientes reais de legado ou
serviços reais de canal. O relógio das regras é injetado com data fictícia; a
autenticação utiliza JWT e escopos reais do backend sobre usuários descartáveis.

O teste integrado verifica autenticação, aprovação, revalidação HTTP, escrita
simulada seguida de releitura, persistência no Higia, repetição após recuperação,
bloqueio do token de registro e separação dos estados no navegador.

## Limites e próxima ativação

Não há factory de ambiente para a nova escrita, provisionamento de token,
reconciliação/desbloqueio de resultado desconhecido ou migrations em banco de uso
normal. As migrações novas foram aplicadas somente na homologação descartável.
O envio e a escrita reais permanecem bloqueados.

Para o piloto: revisar a composição operacional e a recuperação, provisionar
credenciais de finalidade exclusiva, homologar o provedor/inbox/template, fechar
texto/janela/prazo e obter autorizações específicas para deploy, envio e confirmação
reais. Esta entrega não concede essas autorizações nem cria evidência jurídica real.

## Resultado da validação em 10/11/2026

- Python: 575 testes unittest aprovados, `.env` desabilitado e dados fictícios.
  Não há typechecker Python configurado.
- Backend: 75 testes Jest aprovados em seis suítes administrativas; typecheck
  TypeScript sem emissão aprovado com Prisma gerado em dependências privadas.
- Bridge: 419 testes encontrados, 416 aprovados e três integrações opcionais
  ignoradas na suíte comum; typecheck aprovado. A nova integração do legado foi
  executada separadamente pelo runner e passou.
- Frontend: build/TypeScript e quatro testes de autorização aprovados. O aviso de
  tamanho dos bundles permanece. A homologação no Chromium passou com APIs reais
  autenticadas sobre fixtures, sem requisições externas.
- Integração: PostgreSQL descartável com migrations, Nest/Auth, API Python,
  PGlite e HTTP simulado do legado. A repetição manteve uma escrita e um evento
  de confirmação; o token de leitura do registro foi recusado na escrita.
- Recursos descartáveis, sessões e tokens de teste foram removidos pelo runner.
  Nenhuma migration, mensagem ou confirmação real foi executada.
