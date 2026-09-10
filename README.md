# Appointments Backend

Guia rapido para executar a API localmente (sem Docker) e com Docker.

## Pre-requisitos

- Node.js 20+
- npm 10+
- Docker e Docker Compose (opcional, para execucao com containers)

## 1) Configurar ambiente

Instale as dependencias:

```bash
npm install
```

Crie o arquivo `.env` na raiz do projeto (se ainda nao existir), com o formato:

```env
DATABASE_URL="postgresql://appointments_dev:appointments_dev@localhost:5432/appointments_dev?schema=public"
JWT_SECRET="appointments_local_secret_change_me"
JWT_EXPIRES_IN="1d"
GPT_MAKER_TOKEN="seu_token_gpt_maker"
MINIO_ENDPOINT="http://localhost:9000"
MINIO_BUCKET="appointments"
MINIO_ACCESS_KEY="appointments"
MINIO_SECRET_KEY="appointments_minio_dev"
```

## 2) Preparar banco de dados (sem Docker)

Com um PostgreSQL local em execucao e acessivel via `DATABASE_URL`:

```bash
npm run prisma:db:push
npm run prisma:seed
```

Opcional (abrir Prisma Studio):

```bash
npm run prisma:studio
```

## 3) Rodar projeto em desenvolvimento (sem Docker)

```bash
npm run start:dev
```

API: `http://localhost:3000/api`  
Swagger: `http://localhost:3000/api/docs`

## 4) Rodar com Docker (API + Postgres + MinIO)

Arquivos de guias e de contas a pagar ficam no MinIO (volume `minio_data`), nao no disco da API.

Documentos antigos em `uploads/` no disco da API nao sao migrados automaticamente.

Console MinIO (dev): `http://localhost:9001`  
Usuario/senha: `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` em `.env.docker.dev`.

### Ambiente de desenvolvimento

```bash
npm run docker:dev:up
```

Para parar:

```bash
npm run docker:dev:down
```

### Ambiente de producao local

```bash
npm run docker:prod:up
```

Para parar:

```bash
npm run docker:prod:down
```

## Portas padrao

- Dev API: `http://localhost:3000/api`
- Dev Postgres: `localhost:5432`
- Dev MinIO S3: `localhost:9000`
- Dev MinIO console: `http://localhost:9001`
- Prod API: `http://localhost:3001/api`
- Prod Postgres: `localhost:5433`
- Prod MinIO S3: `localhost:9010`
- Prod MinIO console: `http://localhost:9011`

Variaveis MinIO: `MINIO_ENDPOINT`, `MINIO_BUCKET`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`. No Compose, `MINIO_ENDPOINT=http://minio:9000`. Sem Docker, use `http://localhost:9000` com o MinIO do Compose no ar.

## Scripts uteis

```bash
# build
npm run build

# iniciar build de producao
npm run start:prod

# testes
npm run test
npm run test:e2e
npm run test:cov
```

## Messages (WhatsApp / GPT Maker)

Webhook de conversa finalizada: `POST /api/messages`.

O body segue o payload do GPT Maker (`interactionId`, `recipient`, `finishAt`, `humanEmail`, ...). A API busca o historico em `GET https://api.gptmaker.ai/v2/interaction/{interactionId}/messages` usando `GPT_MAKER_TOKEN` e grava o JSON em `content`. Cada POST cria um novo registro.

| Metodo | Rota | Descricao |
|--------|------|-----------|
| `POST` | `/messages` | Registrar conversa (webhook) |
| `GET` | `/messages` | Listar conversas |
| `GET` | `/messages/:id` | Buscar por id |
| `PATCH` | `/messages/:id` | Atualizar `recordStatus` / `note` |

## Modulo de estoque

### Lotes (`/api/stock-batches`)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| `POST` | `/stock-batches` | Criar lote (entrada). `isClosed` inicia como `false`. |
| `GET` | `/stock-batches` | Listar lotes abertos (`status=open`, padrao). |
| `GET` | `/stock-batches?status=closed` | Listar somente lotes fechados. |
| `GET` | `/stock-batches?status=all` | Listar todos os lotes (abertos e fechados). |
| `GET` | `/stock-batches/:id` | Buscar lote por id. |
| `PATCH` | `/stock-batches/:id/close` | Fechar lote manualmente (`isClosed=true`). |
| `PATCH` | `/stock-batches/:id` | Atualizar lote. |
| `DELETE` | `/stock-batches/:id` | Remover lote. |

**Regras de negocio:**

- Ao criar um lote, `isClosed` e `false` por padrao.
- Quando `currentQuantity` chega a `0` (via saida de estoque ou atualizacao do lote), `isClosed` e definido automaticamente como `true`.
- A consolidacao de estoque em `/api/products/stock-consolidation` considera apenas lotes abertos (`isClosed=false`).

### Saidas (`/api/stock-exits`)

Ao registrar uma saida que zera o saldo do lote, o lote e fechado automaticamente.

