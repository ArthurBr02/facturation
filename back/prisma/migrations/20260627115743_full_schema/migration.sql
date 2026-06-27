-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('pro', 'particulier');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('devis', 'avenant', 'facture', 'contrat');

-- CreateEnum
CREATE TYPE "NumberSeries" AS ENUM ('DEV', 'AVE', 'FAC', 'AVO', 'MNT');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('pending', 'failed', 'done');

-- CreateEnum
CREATE TYPE "UniteService" AS ENUM ('jour', 'heure', 'forfait', 'unite');

-- CreateEnum
CREATE TYPE "DevisStatut" AS ENUM ('brouillon', 'finalise', 'envoye', 'accepte', 'refuse', 'expire', 'annule');

-- CreateEnum
CREATE TYPE "AvenantStatut" AS ENUM ('brouillon', 'finalise', 'envoye', 'accepte', 'refuse', 'annule');

-- CreateEnum
CREATE TYPE "FactureType" AS ENUM ('standard', 'acompte', 'solde', 'avoir');

-- CreateEnum
CREATE TYPE "FactureStatut" AS ENUM ('brouillon', 'finalisee', 'payee', 'partielle');

-- CreateEnum
CREATE TYPE "MoyenPaiement" AS ENUM ('virement', 'malt', 'especes', 'cheque', 'autre');

-- CreateEnum
CREATE TYPE "ContratStatut" AS ENUM ('actif', 'suspendu', 'resilie');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'pro',
    "pays" TEXT NOT NULL DEFAULT 'France',
    "nom" TEXT NOT NULL,
    "denomination" TEXT,
    "forme_juridique" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "adresse1" TEXT,
    "adresse2" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "siren" TEXT,
    "tva_intra" TEXT,
    "conditions_paiement" INTEGER,
    "contact_principal" TEXT,
    "tjm_negocie" DECIMAL(12,2),
    "notes_internes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "cle" TEXT NOT NULL,
    "valeur" TEXT,
    "groupe" TEXT NOT NULL,
    "label" TEXT,
    "requis" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_step" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "description" TEXT,
    "est_defaut" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "custom_html" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_lines" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "designation_template" TEXT NOT NULL,
    "quantite_template" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "prix_unitaire_template" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "template_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_clauses" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "cle" TEXT NOT NULL,
    "contenu_template" TEXT NOT NULL,

    CONSTRAINT "template_clauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_counters" (
    "annee" INTEGER NOT NULL,
    "serie" "NumberSeries" NOT NULL,
    "dernier_numero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "number_counters_pkey" PRIMARY KEY ("annee","serie")
);

-- CreateTable
CREATE TABLE "upload_queue" (
    "id" SERIAL NOT NULL,
    "file_path" TEXT NOT NULL,
    "drive_path" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt" TIMESTAMP(3),
    "error_message" TEXT,
    "document_type" TEXT,
    "document_id" INTEGER,
    "drive_file_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produits" (
    "id" SERIAL NOT NULL,
    "reference" TEXT,
    "designation" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT,
    "prix_defaut" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unite" "UniteService" NOT NULL DEFAULT 'unite',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER,
    "numero" TEXT,
    "statut" "DevisStatut" NOT NULL DEFAULT 'brouillon',
    "titre" TEXT,
    "description" TEXT,
    "date_emission" DATE NOT NULL,
    "validite_jours" INTEGER NOT NULL DEFAULT 30,
    "total_ht" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "acompte_pct" DECIMAL(5,2),
    "cycles_inclus" INTEGER NOT NULL DEFAULT 3,
    "cycles_utilises" INTEGER NOT NULL DEFAULT 0,
    "clause_revision" TEXT,
    "clause_hebergement" TEXT,
    "verrouillee" BOOLEAN NOT NULL DEFAULT false,
    "date_envoi" TIMESTAMP(3),
    "signed_pdf_path" TEXT,
    "snapshot" JSONB,
    "pdf_path" TEXT,
    "finalisee_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis_lines" (
    "id" SERIAL NOT NULL,
    "devis_id" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "prix_unitaire" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "devis_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avenants" (
    "id" SERIAL NOT NULL,
    "devis_id" INTEGER NOT NULL,
    "numero" TEXT,
    "statut" "AvenantStatut" NOT NULL DEFAULT 'brouillon',
    "objet" TEXT,
    "description" TEXT,
    "delai_add" INTEGER,
    "total_ht" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "verrouillee" BOOLEAN NOT NULL DEFAULT false,
    "date_emission" DATE NOT NULL,
    "date_envoi" TIMESTAMP(3),
    "signed_pdf_path" TEXT,
    "snapshot" JSONB,
    "pdf_path" TEXT,
    "finalisee_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avenant_lines" (
    "id" SERIAL NOT NULL,
    "avenant_id" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "prix_unitaire" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "avenant_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures" (
    "id" SERIAL NOT NULL,
    "numero" TEXT,
    "type" "FactureType" NOT NULL DEFAULT 'standard',
    "statut" "FactureStatut" NOT NULL DEFAULT 'brouillon',
    "client_id" INTEGER,
    "devis_id" INTEGER,
    "contrat_id" INTEGER,
    "facture_origine_id" INTEGER,
    "date_emission" DATE NOT NULL,
    "date_execution_debut" DATE,
    "date_execution_fin" DATE,
    "date_echeance" DATE,
    "bon_commande" TEXT,
    "conditions_reglement" TEXT,
    "objet" TEXT,
    "notes" TEXT,
    "total_ht" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "verrouillee" BOOLEAN NOT NULL DEFAULT false,
    "snapshot" JSONB,
    "pdf_path" TEXT,
    "finalisee_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facture_lines" (
    "id" SERIAL NOT NULL,
    "facture_id" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "prix_unitaire" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "facture_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encaissements" (
    "id" SERIAL NOT NULL,
    "facture_id" INTEGER NOT NULL,
    "date_encaissement" DATE NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "moyen" "MoyenPaiement" NOT NULL DEFAULT 'virement',
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encaissements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrats_maintenance" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "statut" "ContratStatut" NOT NULL DEFAULT 'actif',
    "titre" TEXT,
    "description" TEXT,
    "date_debut" DATE NOT NULL,
    "duree_mois" INTEGER,
    "reconduction" BOOLEAN NOT NULL DEFAULT true,
    "preavis_jours" INTEGER NOT NULL DEFAULT 30,
    "montant_mensuel" DECIMAL(12,2) NOT NULL,
    "heures_incluses" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "report_heures" BOOLEAN NOT NULL DEFAULT false,
    "thm_depassement" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "perimetre_couvert" TEXT,
    "exclusions" TEXT,
    "snapshot" JSONB,
    "pdf_path" TEXT,
    "date_resiliation" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrats_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "id" SERIAL NOT NULL,
    "contrat_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "duree_h" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodes_maintenance" (
    "id" SERIAL NOT NULL,
    "contrat_id" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "facture_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periodes_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenus_malt" (
    "id" SERIAL NOT NULL,
    "date_encaissement" DATE NOT NULL,
    "montant_net" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenus_malt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "clients_nom_idx" ON "clients"("nom");

-- CreateIndex
CREATE INDEX "app_settings_groupe_idx" ON "app_settings"("groupe");

-- CreateIndex
CREATE INDEX "templates_type_idx" ON "templates"("type");

-- CreateIndex
CREATE INDEX "template_lines_template_id_idx" ON "template_lines"("template_id");

-- CreateIndex
CREATE INDEX "template_clauses_template_id_idx" ON "template_clauses"("template_id");

-- CreateIndex
CREATE INDEX "upload_queue_status_idx" ON "upload_queue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "produits_reference_key" ON "produits"("reference");

-- CreateIndex
CREATE INDEX "produits_actif_idx" ON "produits"("actif");

-- CreateIndex
CREATE INDEX "produits_categorie_idx" ON "produits"("categorie");

-- CreateIndex
CREATE UNIQUE INDEX "devis_numero_key" ON "devis"("numero");

-- CreateIndex
CREATE INDEX "devis_statut_idx" ON "devis"("statut");

-- CreateIndex
CREATE INDEX "devis_client_id_idx" ON "devis"("client_id");

-- CreateIndex
CREATE INDEX "devis_lines_devis_id_idx" ON "devis_lines"("devis_id");

-- CreateIndex
CREATE UNIQUE INDEX "avenants_numero_key" ON "avenants"("numero");

-- CreateIndex
CREATE INDEX "avenants_statut_idx" ON "avenants"("statut");

-- CreateIndex
CREATE INDEX "avenants_devis_id_idx" ON "avenants"("devis_id");

-- CreateIndex
CREATE INDEX "avenant_lines_avenant_id_idx" ON "avenant_lines"("avenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "factures_numero_key" ON "factures"("numero");

-- CreateIndex
CREATE INDEX "factures_statut_idx" ON "factures"("statut");

-- CreateIndex
CREATE INDEX "factures_client_id_idx" ON "factures"("client_id");

-- CreateIndex
CREATE INDEX "facture_lines_facture_id_idx" ON "facture_lines"("facture_id");

-- CreateIndex
CREATE INDEX "encaissements_facture_id_idx" ON "encaissements"("facture_id");

-- CreateIndex
CREATE INDEX "encaissements_date_encaissement_idx" ON "encaissements"("date_encaissement");

-- CreateIndex
CREATE UNIQUE INDEX "contrats_maintenance_numero_key" ON "contrats_maintenance"("numero");

-- CreateIndex
CREATE INDEX "contrats_maintenance_statut_idx" ON "contrats_maintenance"("statut");

-- CreateIndex
CREATE INDEX "contrats_maintenance_client_id_idx" ON "contrats_maintenance"("client_id");

-- CreateIndex
CREATE INDEX "interventions_contrat_id_idx" ON "interventions"("contrat_id");

-- CreateIndex
CREATE INDEX "interventions_date_idx" ON "interventions"("date");

-- CreateIndex
CREATE UNIQUE INDEX "periodes_maintenance_facture_id_key" ON "periodes_maintenance"("facture_id");

-- CreateIndex
CREATE INDEX "periodes_maintenance_contrat_id_idx" ON "periodes_maintenance"("contrat_id");

-- CreateIndex
CREATE UNIQUE INDEX "periodes_maintenance_contrat_id_annee_mois_key" ON "periodes_maintenance"("contrat_id", "annee", "mois");

-- CreateIndex
CREATE INDEX "revenus_malt_date_encaissement_idx" ON "revenus_malt"("date_encaissement");

-- AddForeignKey
ALTER TABLE "template_lines" ADD CONSTRAINT "template_lines_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_clauses" ADD CONSTRAINT "template_clauses_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis_lines" ADD CONSTRAINT "devis_lines_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avenants" ADD CONSTRAINT "avenants_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avenant_lines" ADD CONSTRAINT "avenant_lines_avenant_id_fkey" FOREIGN KEY ("avenant_id") REFERENCES "avenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_contrat_id_fkey" FOREIGN KEY ("contrat_id") REFERENCES "contrats_maintenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_facture_origine_id_fkey" FOREIGN KEY ("facture_origine_id") REFERENCES "factures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture_lines" ADD CONSTRAINT "facture_lines_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaissements" ADD CONSTRAINT "encaissements_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrats_maintenance" ADD CONSTRAINT "contrats_maintenance_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_contrat_id_fkey" FOREIGN KEY ("contrat_id") REFERENCES "contrats_maintenance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodes_maintenance" ADD CONSTRAINT "periodes_maintenance_contrat_id_fkey" FOREIGN KEY ("contrat_id") REFERENCES "contrats_maintenance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodes_maintenance" ADD CONSTRAINT "periodes_maintenance_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
