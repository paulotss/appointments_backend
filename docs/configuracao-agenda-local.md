# Agenda Saúde Vianet no desenvolvimento local

## Falha encontrada e correção

O serviço `app` carregava somente `.env.docker.dev`. A URL
`SAUDEVIANET_INTERNAL_API_BASE` e o token `SAUDEVIANET_INTERNAL_API_TOKEN`
estavam em `.env.development.local`, ignorado pelo Git, e não chegavam ao backend.
Isso produzia `source_not_configured` e a mensagem “Integração da agenda não
configurada”, antes de qualquer consulta ao Saúde Vianet.

A primeira correção usava `.tmp/compose.agenda.local.yml` como arquivo Compose
adicional. Funcionava no container recriado, mas um `down` seguido de `up` usando
apenas `docker-compose.dev.yml` descartava essa sobreposição.

Agora o próprio `docker-compose.dev.yml` carrega `.env.development.local` depois
do arquivo de desenvolvimento. O arquivo local é opcional para outros ambientes;
quando existe, seus valores prevalecem. Nenhum segredo foi incluído no Git e as
chaves e tokens existentes foram preservados.

## Reinício

Utilize o mesmo projeto Compose já usado pelo seu ambiente. Por exemplo, para o
projeto local `appointments_backend`:

```sh
docker compose -p appointments_backend -f docker-compose.dev.yml down
docker compose -p appointments_backend -f docker-compose.dev.yml up -d
```

Não use `down -v`: removeria os volumes do banco. O comando original de
inicialização do projeto continua inalterado, incluindo suas etapas de instalação,
geração Prisma e migração. A correção acima modifica somente o carregamento do
arquivo local de configuração.

Os serviços Python são processos separados dos containers e precisam continuar
ativos no Fedora WSL. Em terminais separados:

```sh
cd /home/paulodt/mcps/saudevianet_mcp_py
.venv/bin/saudevianet-internal-api
```

```sh
cd /home/paulodt/mcps/saudevianet_mcp_py
.venv/bin/saudevianet-recipient-resolver
```

Eles escutam somente em localhost, nas portas 8765 e 8766. Não inicie cópias se
as portas já estiverem em uso. `docker compose down` não gerencia esses processos;
encerrar o WSL ou seus terminais pode pará-los.

## Campanhas existentes

A campanha criada durante a falha armazena o resultado daquela coleta. Reabrir
a página ou reiniciar o backend não executa uma nova leitura. A tela ainda não
possui ação de recoleta; a correção de configuração afeta as próximas consultas,
sem apagar ou substituir campanhas existentes.

## Validação e limites

O Compose foi validado com arquivo local presente, ausente e com valores fictícios
que sobrescrevem o arquivo base. Um container descartável iniciado com apenas o
Compose padrão confirmou o recebimento da URL/token e a conexão autenticada com
a API Python, usando data inválida para não consultar agendamentos reais.

O backend local foi reiniciado com compilação em tmpfs e sem executar migrações
nesta validação. Nenhum envio WhatsApp, alteração de agendamento ou deploy foi
realizado. A validação anterior da leitura de 06/11/2026 havia retornado 64
agendamentos sem falhas de consulta.

Typecheck TypeScript sem emissão aprovado. Os testes desta correção não repetiram
a consulta de agenda real nem alteraram campanhas existentes.
