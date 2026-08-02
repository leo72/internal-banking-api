-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "api_key_hash" CHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "balance_minor" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "accounts_balance_nonnegative" CHECK ("balance_minor" >= 0),
    CONSTRAINT "accounts_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$')
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" UUID NOT NULL,
    "source_account_id" UUID NOT NULL,
    "destination_account_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "source_balance_after" BIGINT NOT NULL,
    "destination_balance_after" BIGINT NOT NULL,
    "initiated_by_employee_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "transfers_distinct_accounts" CHECK ("source_account_id" <> "destination_account_id"),
    CONSTRAINT "transfers_positive_amount" CHECK ("amount_minor" > 0),
    CONSTRAINT "transfers_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$')
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "operation" VARCHAR(64) NOT NULL,
    "employee_id" UUID NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "transfer_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "idempotency_records_response_status_valid" CHECK ("response_status" BETWEEN 100 AND 599)
);

-- CreateTable
CREATE TABLE "account_comments" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "created_by_employee_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_comments_body_nonempty" CHECK (length(btrim("body")) > 0)
);

-- CreateTable
CREATE TABLE "account_locks" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "locked_by_employee_id" UUID NOT NULL,
    "unlocked_by_employee_id" UUID,
    "locked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlocked_at" TIMESTAMPTZ(3),

    CONSTRAINT "account_locks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_locks_reason_nonempty" CHECK (length(btrim("reason")) > 0),
    CONSTRAINT "account_locks_unlock_consistent" CHECK (
        (
            "unlocked_at" IS NULL
            AND "unlocked_by_employee_id" IS NULL
        )
        OR
        (
            "unlocked_at" IS NOT NULL
            AND "unlocked_by_employee_id" IS NOT NULL
            AND "unlocked_at" >= "locked_at"
        )
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_api_key_hash_key" ON "employees"("api_key_hash");

-- CreateIndex
CREATE INDEX "accounts_customer_id_idx" ON "accounts"("customer_id");

-- CreateIndex
CREATE INDEX "transfers_source_account_id_created_at_id_idx" ON "transfers"("source_account_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "transfers_destination_account_id_created_at_id_idx" ON "transfers"("destination_account_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "transfers_initiated_by_employee_id_idx" ON "transfers"("initiated_by_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_transfer_id_key" ON "idempotency_records"("transfer_id");

-- CreateIndex
CREATE INDEX "idempotency_records_created_at_idx" ON "idempotency_records"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_operation_key_hash_key" ON "idempotency_records"("operation", "key_hash");

-- CreateIndex
CREATE INDEX "account_comments_account_id_created_at_id_idx" ON "account_comments"("account_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "account_comments_created_by_employee_id_idx" ON "account_comments"("created_by_employee_id");

-- CreateIndex
CREATE INDEX "account_locks_account_id_locked_at_id_idx" ON "account_locks"("account_id", "locked_at", "id");

-- Only one active lock can exist for an account.
CREATE UNIQUE INDEX "account_locks_one_active_per_account"
    ON "account_locks"("account_id")
    WHERE "unlocked_at" IS NULL;

-- CreateIndex
CREATE INDEX "account_locks_locked_by_employee_id_idx" ON "account_locks"("locked_by_employee_id");

-- CreateIndex
CREATE INDEX "account_locks_unlocked_by_employee_id_idx" ON "account_locks"("unlocked_by_employee_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_initiated_by_employee_id_fkey" FOREIGN KEY ("initiated_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_comments" ADD CONSTRAINT "account_comments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_comments" ADD CONSTRAINT "account_comments_created_by_employee_id_fkey" FOREIGN KEY ("created_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_locks" ADD CONSTRAINT "account_locks_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_locks" ADD CONSTRAINT "account_locks_locked_by_employee_id_fkey" FOREIGN KEY ("locked_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_locks" ADD CONSTRAINT "account_locks_unlocked_by_employee_id_fkey" FOREIGN KEY ("unlocked_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
