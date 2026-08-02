ALTER TABLE "transfers"
ADD CONSTRAINT "transfers_balances_nonnegative"
CHECK (
    "source_balance_after" >= 0
    AND "destination_balance_after" >= 0
);

ALTER TABLE "idempotency_records"
DROP CONSTRAINT "idempotency_records_employee_id_fkey";

ALTER TABLE "idempotency_records"
RENAME COLUMN "employee_id" TO "created_by_employee_id";

ALTER TABLE "idempotency_records"
ADD CONSTRAINT "idempotency_records_created_by_employee_id_fkey"
FOREIGN KEY ("created_by_employee_id")
REFERENCES "employees"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
