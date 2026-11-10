# Preparação operacional — 10/11/2026

> Registro histórico desta entrega. Para o estado atual e os limites da homologação,
> consulte [Homologação Evolution](homologacao-confirmacao-evolution.md).

## Estado efetivo do servidor

O canal escolhido é **Chatwoot + Evolution API** em `192.168.1.205`, alias
`seraphis-prod`. A Evolution 2.3.7 foi instalada em
`/home/seraphis/higia-evolution`, com imagem amd64 fixada por digest, PostgreSQL,
Redis e volumes próprios. A API autenticada respondeu com lista de instâncias
vazia. A integração Chatwoot está desativada. Não houve pareamento, envio,
confirmação no legado ou desligamento do GPTMaker.

O Chatwoot existente é 4.18.0, com uma conta e inbox 1 do tipo WebWidget. Não foram
consultados contatos/conversas nem alteradas suas configurações. O acesso usou a
identidade do alias com `Hostname=192.168.1.205`, pois a rota do alias não respondeu.
Sem sudo disponível, a instalação foi feita no diretório do usuário `seraphis`.

As credenciais novas foram geradas no servidor, em arquivos 0600, sem exibição ou
cópia para o Git. Nomes DNS exclusivos evitam colisão com o banco/cache Chatwoot.
A API só publica 8080 em loopback; banco/cache não publicam portas. O stdout da
API não é persistido, pois a inicialização do fornecedor pode incluir informações
de conexão. A verificação de saúde não consulta contatos ou mensagens.

## Autorização e recuperação

O Higia agora exige evento **já persistido** de resposta explícita, sem bloqueio,
ligado à execução e ao retrato imutável da aprovação, antes de autorizar escrita.
As rotas `POST /api/confirmation-execution/authorize-appointment` e
`POST .../authorize-reconciliation` usam `CONFIRMATION_EXECUTION_READ`.

O Bridge publica a manifestação antes da tentativa. Falha de publicação mantém a
tarefa pendente sem alcançar o legado. Cada guarda Python carrega um cliente de
registro novo para não reutilizar autorização em cache entre leituras; apenas as
conexões HTTP são compartilhadas.

A reconciliação Python usa token exclusivo e journal existente. Valida evidência
histórica no Higia e exige duas leituras do mesmo paciente, agendamento, horário e
estado confirmado. Ausência, alteração, estado marcado ou falha técnica continuam
indeterminados. Não cria evidência nem libera repetição. O novo evento
`appointment_reconciliation` só permite `indeterminate` → `confirmed`; a pendência
original permanece para tratamento auditado pela recepção.

A reconciliação do transporte busca correspondência técnica única em histórico
paginado e não envia mensagens. Reservas antigas interrompidas passam a incerteza;
sem prova continuam bloqueadas. Aceite Chatwoot não equivale a entrega WhatsApp.

## Composição e comandos

`confirmations:operate` oferece `check-config`, `serve`, `dispatch <campanha>
<item>`, `reconcile-transport <executionKey>`, `reconcile-appointment
<executionKey>` e `expire`. O antigo `confirmations:dispatch` continua fechado.
Não foi instalado cron de envio.

O padrão é `CONFIRMATIONS_MODE=disabled`. `observe` pode persistir/sincronizar
eventos, mas não encaminha conversas, não envia e não confirma. `active` ainda
exige flags distintas para disparo e escrita; disparo exige lista explícita de
campanhas. A checagem de configuração não acessa banco/rede e só imprime estados.
O exemplo `higia-chat/evolution/confirmation.env.example` fica desativado e vazio.

A entrada Python `saudevianet-appointment-service` não foi iniciada em produção.
Exige `PYTHON_DOTENV_DISABLED=1`, HMACs e IDs existentes, registro Higia, autorização
da resposta persistida e journal absoluto em diretório persistente protegido.
`LEGACY_CONFIRMATION_WRITES_ENABLED` começa desativado. Os tokens de confirmação,
reconciliação e leitura da aprovação são distintos, sem rotação dos existentes.

## Evolution e callback

O adaptador exige inbox **API**, callback exato, sessão aberta, vínculo de conta e
instância e ausência de assinatura automática de texto, importação de históricos
e fusão automática de contatos. Texto final precisa de `{{date}}` e `{{time}}`;
nenhum texto real foi aprovado. O template Meta não é aplicado à Evolution.

A referência opaca fica em `higia_confirmation_contact_key`, não em `identifier`,
que a Evolution usa como destino WhatsApp. Contato já existente sem esse vínculo
gera análise, sem seleção por nome/telefone ou fusão automática. A vinculação de
contatos existentes precisa ser verificada antes de incluí-los no piloto.

O CORS permaneceu restrito. A revisão automática recusou mudar para `*`; a mudança
não foi executada. Leituras autenticadas usam a origem permitida. Está preparado,
mas **não instalado**, o relay `evolution/callback.compose.yaml`: exige IPs exatos de
Rails/Sidekiq, assinatura/timestamp de inbox dedicada e vínculo de conta/inbox. Só repassa
mensagens públicas de saída a uma instância fixa, sem ampliar o CORS. Um journal
reserva incerteza antes da chamada e impede repetição após interrupção/timeout.
Não guarda corpo, telefone ou credencial. A porta 8769 se vincula somente ao IP privado da ponte Docker, com IPs exatos de origem; o processo usa a rede do host. Antes do callback de campanha, o Bridge exige evidência persistida, campanha permitida e nova validação independente de autorização e destinatário. Corridas com a persistência bloqueiam o envio e não liberam repetição automática.

No fluxo Evolution, ausência de recibo após o prazo vira pendência técnica, sem
classificar o paciente como silencioso. Recibos, respostas citadas e desconexão
ainda precisam ser homologados com canal pareado antes da liberação do piloto.

## Implantação e troca

1. Revisar/integrar as entregas coordenadas e definir os destinos de Higia/Python,
   endpoints e credenciais exclusivas. Não substituir HMACs nem reutilizar tokens.
2. Preparar backups protegidos e recuperação de bancos, journals e sessões.
   Aplicar migrations, regenerar Prisma em ambiente privado e iniciar os serviços
   desativados ou em observação, com reinício supervisionado.
3. Provisionar conta de integração, inbox API exclusiva, atributo opaco e segredo
   do callback. Instalar relay com IPs/IDs exatos. Criar instância sem importação
   automática e verificar seu vínculo com a inbox. Não reutilizar o WebWidget.
4. Fechar texto, janela existente de 08h–18h em São Paulo, prazo e responsáveis.
   Conferir evidências individuais, revogação e responsável legal.
5. Em janela acompanhada, parear o número e homologar canal/recibos em escopo
   autorizado. Desabilitar GPTMaker na troca, preservando histórico e recuperação.
   Não deixar os dois robôs respondendo ao mesmo número.
6. Após validação e autorização específicas, liberar campanha limitada e escrita
   real. Acompanhar filas, incerteza, journals e pendências antes de ampliar.

Para parar somente a instalação nova, preservando os dados:

```sh
docker compose -f ~/higia-evolution/production.compose.yaml stop
```

Não usar `down -v`, remover sessões, recriar credenciais ou desconectar GPTMaker
como diagnóstico. Reversão de serviço não desfaz efeitos externos; eles exigem
reconciliação por leitura.

## Referências verificadas

- [Evolution 2.3.7: Chatwoot](https://github.com/evolution-foundation/evolution-api/blob/2.3.7/src/api/integrations/chatbot/chatwoot/services/chatwoot.service.ts)
- [Evolution: configuração](https://github.com/evolution-foundation/evolution-api/blob/2.3.7/.env.example)
- [Evolution: CORS](https://github.com/evolution-foundation/evolution-api/blob/2.3.7/src/main.ts)
- [Chatwoot 4.18: API](https://github.com/chatwoot/chatwoot/blob/v4.18.0/app/models/channel/api.rb)

## Destinos confirmados e gateway Render

- Backend: `https://appointments-backend-6mjr.onrender.com`.
- Frontend: `https://appointments-frontend-lme9.onrender.com`.
- Origem Saúde Vianet: `https://saudevianetmcp.paulodt.com.br`.
- Rota de túnel solicitada: HTTP → `http://127.0.0.1:8768`.

O checkout antigo em `/opt/higia-chat/mcps/saudevianet_mcp_py` estava limpo na
branch `feat/mvp-consultas-informativas`, commit `0d74fbd`, sem resolvedor atual.
Foi preservado. O release paralelo está em
`/opt/higia-chat/releases/confirmacao-operacional-python-20261110`, com ambiente
virtual e cópia privada de dependências, validado com fixtures no Python 3.14.
Não altera o MCP usado pelo Bridge/Hermes existentes.

`saudevianet-render-api.service` está ativo e habilitado no systemd do usuário,
com linger habilitado, UMask 0077 e dotenv desabilitado. Publica em loopback somente
as quatro rotas administrativas e `/healthz`. O token exclusivo está em
`~/.config/higia-confirmations/render-api.env`, arquivo 0600, sem exibição.
Reutiliza apenas as credenciais do cliente Saúde Vianet, para a mesma finalidade,
do arquivo antigo; não copiou chaves ou tokens de desenvolvimento.

Validação sem agenda real: saúde 200, leitura sem token 401, requisição autenticada
com data inválida 422, telefone e escrita ausentes (404). O teste público final de `/healthz` retornou 200 após configuração da rota.
A autenticação externa das rotas administrativas ainda precisa ser homologada
com o backend Render, sem consultar dados reais nesta validação.
O túnel já existente era gerenciado por token; não foi alterado por esta entrega.
O responsável informou ter instalado um novo túnel e configura a rota no painel.

No Render, configurar `SAUDEVIANET_INTERNAL_API_BASE` com a origem HTTPS, sem
`/api`, e `SAUDEVIANET_INTERNAL_API_TOKEN` com o token próprio do gateway, por canal
seguro. Se Access estiver habilitado, o cliente suporta o par exclusivo
`SAUDEVIANET_ACCESS_CLIENT_ID/SECRET`, sem substituir o Bearer. Configuração
parcial, segredo reaproveitado, URL insegura e redirecionamento são recusados.
O arquivo `docs/render-source.env.example` contém somente nomes e valores públicos.

A configuração antiga do MCP possui credenciais do legado, mas não possui os
HMACs/IDs nem os tokens novos do registro/resolvedor. Eles não foram inventados ou
copiados do desenvolvimento. Antes de liberar a coleta real, avaliar vínculos de
referência existentes e provisionar configuração de produção compatível. Falta
de evidência mantém a elegibilidade bloqueada. Backend/frontend Render não foram
publicados ou reconfigurados por esta entrega.

## Validação consolidada

- Python: 583 testes locais aprovados; também foi validado o release paralelo no
  Python 3.14 do servidor, sempre com fixtures e dotenv desabilitado.
- Backend: 81 testes administrativos e typecheck TypeScript sem emissão aprovados.
- Bridge: suíte consolidada com 428 testes aprovados e três integrações opcionais
  ignoradas; regressões adicionais de reconciliação e isolamento de conta aprovadas.
- Preparação Evolution/callback: seis testes Python sem canal real aprovados.
- Integração em PostgreSQL descartável e Chromium: perda simulada da resposta de
  escrita, reconciliação sem segunda escrita, evidência persistida e interface
  aprovadas. Bancos e sessões de fixtures removidos pelo runner.
- Não há typechecker Python configurado. A ausência não foi substituída por
  compilação sintática. As migrations do fluxo de confirmação continuam aplicadas
  somente em bancos descartáveis, sem alteração no banco Higia de produção.
