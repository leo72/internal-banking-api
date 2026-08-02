ALTER TABLE "accounts"
ADD COLUMN "initial_deposit_minor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "accounts"
ADD CONSTRAINT "accounts_initial_deposit_nonnegative"
CHECK ("initial_deposit_minor" >= 0);
