-- P3-2: Invoice + Payment + PaymentApplication

DO $$ BEGIN CREATE TYPE "public"."InvoiceType" AS ENUM ('AR', 'AP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."InvoiceStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "public"."Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY, "invoiceNumber" TEXT NOT NULL UNIQUE,
    "type" "public"."InvoiceType" NOT NULL, "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "customerId" TEXT, "supplierId" TEXT, "salesOrderId" TEXT UNIQUE, "purchaseOrderId" TEXT UNIQUE,
    "totalAmount" DECIMAL(15,2) NOT NULL, "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "public"."Payment" (
    "id" TEXT NOT NULL PRIMARY KEY, "direction" TEXT NOT NULL, "amount" DECIMAL(15,2) NOT NULL,
    "accountId" TEXT NOT NULL, "customerId" TEXT, "supplierId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "public"."PaymentApplication" (
    "id" TEXT NOT NULL PRIMARY KEY, "paymentId" TEXT NOT NULL, "invoiceId" TEXT NOT NULL,
    "appliedAmount" DECIMAL(15,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS "Invoice_customerId_idx" ON "public"."Invoice"("customerId");
CREATE INDEX IF NOT EXISTS "Invoice_supplierId_idx" ON "public"."Invoice"("supplierId");
CREATE INDEX IF NOT EXISTS "Payment_accountId_idx" ON "public"."Payment"("accountId");
CREATE INDEX IF NOT EXISTS "Payment_date_idx" ON "public"."Payment"("date");
CREATE INDEX IF NOT EXISTS "PaymentApplication_paymentId_idx" ON "public"."PaymentApplication"("paymentId");
CREATE INDEX IF NOT EXISTS "PaymentApplication_invoiceId_idx" ON "public"."PaymentApplication"("invoiceId");

ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."PaymentApplication" ADD CONSTRAINT "PaymentApplication_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."PaymentApplication" ADD CONSTRAINT "PaymentApplication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "public"."SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
