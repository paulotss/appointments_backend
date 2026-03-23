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

API: `http://localhost:3000`  
Swagger: `http://localhost:3000/docs`

## 4) Rodar com Docker (API + Postgres)

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

- Dev API: `http://localhost:3000`
- Dev Postgres: `localhost:5432`
- Prod API: `http://localhost:3001`
- Prod Postgres: `localhost:5433`

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

$2b$10$zOTla1zqUUlXhfwKa573TuoBr8w/6xIV41Whv3KBAgzzldIsA/KMG
