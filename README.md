# Internal Banking API

A production-oriented internal banking API built with Node.js, TypeScript, Express, PostgreSQL, and Prisma.

The API is intended for authenticated bank employees and supports account creation, balance retrieval, transfers, transfer history, internal comments, and account locks.

## Features

- Create multiple accounts for a customer
- Store monetary values as integer minor units
- Transfer funds between accounts
- Prevent overspending during concurrent transfers
- Idempotent transfer requests using `Idempotency-Key`
- Sequential transfer processing through an in-process FIFO queue
- PostgreSQL transactions and row-level account locking
- Retrieve account balances and transfer history
- Add internal account comments
- Lock accounts with a free-text reason
- Prevent incoming and outgoing transfers for locked accounts
- Remove active account locks
- Employee authentication using individual Bearer API keys
- Audit attribution for transfers, comments, locks, and unlocks
- Runtime request validation with TypeBox
- Unit and integration tests with Jest and Supertest
- Docker and Docker Compose support

## Technology

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma
- TypeBox
- Jest
- Supertest
- Pino
- Docker

## Requirements

- Node.js 22+
- npm
- Docker and Docker Compose

## Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

The values in `.env.example` are for local development only. Replace all
credentials before using the application in another environment.

## Running with Docker

Build and start the API, migration service, and PostgreSQL:

```bash
docker compose up --build --detach
```

Seed the example customers and employees:

```bash
docker compose run --rm seed
```

The API is available at <http://localhost:3000>.

Check application health:

```bash
curl http://localhost:3000/health/live
```

Stop the containers:

```bash
docker compose down
```

To also remove the PostgreSQL volume and all stored data:

```bash
docker compose down --volumes
```

## Running Locally

Install dependencies:

```bash
npm ci
```

Start PostgreSQL through Docker:

```bash
docker compose up --detach database
```

PostgreSQL is exposed only on localhost. If port `5432` is already occupied,
change `POSTGRES_PORT` in `.env` before starting the service.

Apply the existing migrations:

```bash
npm run db:migrate:deploy
```

Seed the example customers and employees:

```bash
npm run db:seed
```

Start the development server:

```bash
npm run dev
```

The development API is available at <http://localhost:3000>.