-- Add signed-PDF storage to invoices and maintenance contracts.
ALTER TABLE "factures" ADD COLUMN "signed_pdf_path" TEXT;
ALTER TABLE "contrats_maintenance" ADD COLUMN "signed_pdf_path" TEXT;
