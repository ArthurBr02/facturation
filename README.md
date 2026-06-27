# 📊 Facturation — AB Corp

> Application de gestion commerciale et facturation *self-hosted, mono-utilisateur* sur-mesure pour micro-entreprise (Régime Micro-BNC, Franchise en base de TVA).

Ce projet a été conçu pour structurer l'activité commerciale d'**John Doe (AB Corp)**. Il répond aux exigences strictes de la législation française (inaltérabilité, numérotation séquentielle continue, mentions obligatoires de l'article 293 B du CGI) tout en s'adaptant aux réalités opérationnelles d'un développeur indépendant (cycles de révision, avenants, contrats de maintenance avec heures incluses, relances automatiques et intégration avec Google Drive).

---

## 🚀 Stack Technique & Architecture

L'application est déployée dans une architecture conteneurisée via **Docker Compose** :

```
┌────────────────────────────────────────────────────────┐
│                   Reverse Proxy / HTTPS                │
└───────────────────────────┬────────────────────────────┘
                            │ (Port 8080 / proxy /api)
┌───────────────────────────▼────────────────────────────┐
│                       web (nginx)                      │
│            Frontend Vue 3 (Options API) & Vite         │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                       api (NodeJS)                     │
│  Express API · Prisma ORM · Puppeteer (PDF) · Cron jobs│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                     db (Postgres 16)                   │
│          Persistance transactionnelle des données      │
└────────────────────────────────────────────────────────┘
```

* **Frontend** : [Vue 3](https://vuejs.org/) (Options API), [Vite](https://vite.dev/), [Pinia](https://pinia.vuejs.org/) (gestion d'état), [Vue Router](https://router.vuejs.org/), [Tailwind CSS](https://tailwindcss.com/) pour le design system, et les icônes [Lucide](https://lucide.dev/).
* **Backend** : [Express.js](https://expressjs.com/) (Node.js ≥ 22), modules ESM, validation de schémas avec [Zod](https://zod.dev/).
* **Base de Données** : [PostgreSQL 16](https://www.postgresql.org/), requêtée via l'ORM [Prisma](https://www.prisma.io/).
* **Génération PDF** : [Puppeteer](https://pptr.dev/) (moteur Chromium headless) qui compile à la volée des gabarits HTML conformes en PDF de format A4.
* **Services externes & Résilience** :
  * **Google Drive API** : Stockage automatique à distance des documents PDF finalisés et des sauvegardes de base de données.
  * **File d'attente d'upload (`upload_queue`)** : Service de retry automatique avec alertes par e-mail via [Nodemailer](https://nodemailer.com/) en cas d'échec persistant.
  * **Cron Workers** : Exécution de tâches récurrentes en arrière-plan (génération automatique des contrats mensuels, relance des uploads échoués, sauvegardes hebdomadaires).

---

## ✨ Fonctionnalités Majeures

### 1. Onboarding & Paramètres Émetteur
* **Parcours d'onboarding en 7 étapes** bloquantes pour configurer l'identité de l'entreprise, les coordonnées, les informations bancaires (IBAN/BIC), les mentions légales, et le mot de passe d'administration.
* **Paramètres éditables** avec prévisualisation en direct du bloc d'en-tête de facturation et relance possible de l'assistant d'onboarding.

### 2. Gestion de la Relation Client (CRM 360°)
* Fiches clients différenciées pour les professionnels (**B2B**) et les particuliers (**B2C**).
* **Fiche Client 360°** intégrant la synthèse de l'activité (CA total facturé et encaissé, état des factures, contrats actifs) et l'historique complet de tous leurs documents.
* Enregistrement de données spécifiques : contact principal, TJM négocié, et notes internes libres.

### 3. Cycle de Vie des Documents & Devis
* **Devis (DEV)** : Gestion des brouillons, finalisation avec verrouillage et génération du PDF (comprenant les clauses de révision de TJM, d'hébergement, et de validité).
* **Avenants (AVE)** : Rattachement à un devis accepté pour modifier le périmètre contractuel. L'acceptation d'un avenant répercute et incrémente automatiquement le montant total du devis parent au sein d'une transaction de base de données.
* **Génération de Facture depuis un Devis** : Création automatique d'une facture de solde ou d'acompte (avec calcul en pourcentage `%`) pré-remplie depuis le devis accepté.
* **Catalogue Produits** : Composant de recherche rapide (`ProductPicker`) pour pré-remplir les lignes de devis, d'avenant ou de facture sans FK persistante (évitant tout effet de bord lors d'une modification de catalogue).

### 4. MVP Facturation & Encaissements
* **Factures (FAC) & Avoirs (AVO)** : Création en brouillon, finalisation verrouillant la pièce ( snapshot de l'émetteur et du client figé dans le document) et attribution de numéro séquentiel unique.
* **Recalcul automatique du statut** : Les encaissements saisis (`virement`, `malt`, `espèces`, `chèque`, `autre`) mettent à jour le statut de la facture (`finalisée` ➔ `partielle` ➔ `payée`).
* **Correction par Avoir uniquement** : Conformément à la loi anti-fraude, toute facture finalisée est immuable. Seule la création d'un avoir rattaché (AVO) permet d'annuler ou corriger un montant.

### 5. Contrats de Maintenance Récurrente
* **Contrats (MNT)** : Création d'un contrat actif lié à un forfait mensuel en euros et à un volume d'heures incluses.
* **Suivi des Interventions** : Saisie des interventions par date et durée. L'application calcule en temps réel le total d'heures consommées sur le mois courant et affiche une jauge visuelle d'alerte en cas de dépassement horaire.
* **Facturation Récurrente Automatisée** : Un cron tourne le 1er du mois pour générer les brouillons de factures mensuelles pour tous les contrats actifs (comprenant le forfait et la facturation automatique des heures de dépassement au THM négocié). Une garde stricte empêche la double facturation d'une même période.

### 6. Pilotage & Dashboard Actionnable
* Le tableau de bord agit comme une **Todo-list intelligente** ordonnée par criticité :
  * 🔴 Factures en retard de paiement.
  * 🟠 Devis bientôt expirés ou restés sans réponse.
  * 🔵 Brouillons en cours de rédaction, contrats à facturer.
* **Suivi des seuils** : Calcul du chiffre d'affaires encaissé annuel (trésorerie) par rapport aux plafonds de la franchise en base de TVA (avec jauges visuelles à 70%, 90% et 100%).
* **Relances rapides par e-mail** : Génération en un clic d'un lien `mailto:` pré-rempli (avec identité du contact, montant restant, échéance et coordonnées IBAN) pour relancer les clients en retard de paiement.

---

## 🔒 Séries de Numérotation & Conformité Légale

Toutes les pièces finalisées reçoivent un numéro unique au format `{SERIE}-{ANNEE}-{SEQUENCE}` (ex: `FAC-2026-001`). 

| Série | Usage | Règle de gestion |
| :--- | :--- | :--- |
| **DEV** | Devis | Chronologie et continuité séquentielle. |
| **AVE** | Avenants | Lié à un devis parent, suit son propre compteur. |
| **FAC** | Factures | **Obligation légale de continuité sans trou.** Attribué en transaction DB. |
| **AVO** | Avoirs | Dédié à l'annulation / correction de factures finalisées. |
| **MNT** | Maintenance | Numérotation immédiate dès la création du contrat. |

---

## 📂 Structure du Code Source

```
Facturation/
├── back/                           # Backend Express.js
│   ├── prisma/                     # Schéma de base de données & migrations
│   │   └── schema.prisma
│   └── src/
│       ├── config/                 # Gestion des variables d'environnement et catalogues de paramètres
│       ├── middleware/             # Authentification JWT, gestion d'erreurs et validation Zod
│       ├── routes/                 # Contrôleurs et définitions d'API REST
│       ├── services/               # Services métiers (PDF, Drive, SMTP, Numérotation séquentielle, etc.)
│       ├── templates/              # Gabarits HTML pour la compilation PDF Puppeteer
│       └── workers/                # Jobs d'arrière-plan (cron)
├── front/                          # Frontend Vue.js 3
│   └── src/
│       ├── api/                    # Client HTTP Axios unifié
│       ├── components/             # Composants partagés (BaseModal, ProductPicker, SideNav, TopBar)
│       ├── layouts/                # Mise en page globale (AppShell)
│       ├── stores/                 # Stores d'états Pinia (auth, settings)
│       └── views/                  # Vues applicatives (Dashboard, Clients, Documents, etc.)
├── models/                         # Gabarits HTML originaux et mockups
├── plans/                          # Plans d'exécution du projet et état d'avancement
└── docker-compose.yml              # Orchestration des conteneurs
```

---

## 🛠️ Installation & Démarrage

### 📋 Prérequis
* Docker & Docker Compose installés sur la machine.
* *Pour le développement local (hors Docker)* : [Node.js](https://nodejs.org/) (version 22 ou 24 recommandée via `nvm`).

### 1. Configuration des variables d'environnement
Copiez le fichier exemple `.env.example` à la racine pour créer votre `.env` :
```bash
cp .env.example .env
```
Éditez ensuite le fichier `.env` pour y renseigner vos configurations.

Voici les variables d'environnement disponibles et leur utilité :

#### 🗄️ Base de données (PostgreSQL)
| Variable | Description | Valeur par défaut |
| :--- | :--- | :--- |
| `POSTGRES_USER` | Nom d'utilisateur de la base de données. | `facturation` |
| `POSTGRES_PASSWORD` | Mot de passe de la base de données. | *À modifier impérativement* |
| `POSTGRES_DB` | Nom de la base de données. | `facturation` |
| `POSTGRES_PORT` | Port exposé pour se connecter à PostgreSQL depuis l'extérieur du conteneur. | `5432` |
| `DATABASE_URL` | URL de connexion Prisma. Interne Docker : utilise `db` ; externe local : utilise `localhost`. | `postgresql://facturation:change-me@db:5432/facturation?schema=public` |

#### 🔑 Backend API & Authentification
| Variable | Description | Valeur par défaut |
| :--- | :--- | :--- |
| `NODE_ENV` | Mode d'exécution de l'application (`production` ou `development`). | `production` |
| `API_PORT` | Port d'exposition du serveur API backend. | `3000` |
| `JWT_SECRET` | Clé secrète servant à signer les jetons de session (JWT). | *À modifier (longue chaîne aléatoire)* |
| `JWT_EXPIRES_IN` | Durée de validité d'une session utilisateur. | `7d` |
| `ADMIN_EMAIL` | Adresse e-mail du compte administrateur unique créé automatiquement au premier démarrage. | `admin@example.com` |
| `ADMIN_PASSWORD` | Mot de passe initial du compte administrateur. | *À modifier impérativement* |

#### 🌐 Frontend Web
| Variable | Description | Valeur par défaut |
| :--- | :--- | :--- |
| `WEB_PORT` | Port d'exposition du serveur Nginx hébergeant le frontend. | `8080` |

#### 📂 Stockage distant (Google Drive)

| Variable | Description | Valeur par défaut |
| :--- | :--- | :--- |
| `DRIVE_ENABLED` | Flag d'activation globale des téléversements de PDF/Backups vers Drive (`true` / `false`). | `false` (désactivé en dev local) |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Identifiant du dossier Google Drive racine sous lequel sera créée l'arborescence `Facturation/`. | *À remplir si DRIVE_ENABLED=true* |

**Méthode A — OAuth2 utilisateur (recommandée pour un Drive personnel)**

Les fichiers uploadés appartiennent au compte Google de l'utilisateur. Pas de quota propre au compte de service.

| Variable | Description |
| :--- | :--- |
| `GOOGLE_CLIENT_ID` | Client ID de l'application OAuth2 (type "Desktop app" dans Google Cloud Console). |
| `GOOGLE_CLIENT_SECRET` | Client Secret de l'application OAuth2. |
| `GOOGLE_REFRESH_TOKEN` | Refresh token obtenu via le script `back/scripts/get-drive-token.mjs`. |

**Obtenir le refresh token (one-shot en local) :**
```bash
GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node back/scripts/get-drive-token.mjs
```
Le script ouvre une URL d'autorisation, écoute sur `localhost:4321` et affiche le token à coller dans `.env`.

> Dans Google Cloud Console : activer "Google Drive API" → Credentials → Create OAuth client ID → type **Desktop app** → ajouter `http://localhost:4321/callback` dans les Authorized redirect URIs.

**Méthode B — Compte de service (uniquement Shared Drives / Google Workspace)**

| Variable | Description | Valeur par défaut |
| :--- | :--- | :--- |
| `GOOGLE_APPLICATION_CREDENTIALS` | Chemin interne (dans le conteneur) vers le fichier JSON des identifiants du compte de service. | `/app/storage/google-credentials.json` |

Placez la clé JSON à la racine du projet sous le nom `cle.json`. Au démarrage, Docker la monte dans l'API puis l'entrypoint la copie vers `/app/storage/google-credentials.json`.

#### ✉️ Alertes Système & Messagerie (SMTP)
| Variable | Description | Valeur par défaut |
| :--- | :--- | :--- |
| `MAIL_ENABLED` | Flag d'activation globale des envois d'e-mails d'alerte (`true` / `false`). | `false` (désactivé en dev local) |
| `SMTP_HOST` | Hôte du serveur SMTP sortant. | *Vide* |
| `SMTP_PORT` | Port du serveur SMTP (ex: `587` ou `465`). | `587` |
| `SMTP_SECURE` | Indique si le SMTP utilise TLS/SSL (`true` / `false`). | `false` |
| `SMTP_USER` | Nom d'utilisateur pour la connexion SMTP. | *Vide* |
| `SMTP_PASSWORD` | Mot de passe pour la connexion SMTP. | *Vide* |
| `ALERT_FROM` | Adresse d'expédition des alertes (ex: `facturation@ab-corp.fr`). | `facturation@ab-corp.fr` |
| `ALERT_TO` | Adresse e-mail réceptrice des alertes en cas de panne (ex: backup ou upload Drive échoués). | `admin@example.com` |

#### 🕰️ Tâches d'arrière-plan (Cron)
| Variable | Description | Valeur par défaut |
| :--- | :--- | :--- |
| `UPLOAD_RETRY_CRON` | Expression cron planifiant le retry des téléversements en échec dans la file `upload_queue`. | `*/5 * * * *` (toutes les 5 min) |
| `UPLOAD_MAX_ATTEMPTS` | Nombre maximal de tentatives d'upload avant d'envoyer un mail d'alerte. | `5` |
| `BACKUP_CRON` | Expression cron planifiant la sauvegarde automatique de la base de données. | `0 2 * * 0` (tous les dimanches à 2h00) |

> [!NOTE]
> En développement local, laisser `DRIVE_ENABLED=false` et `MAIL_ENABLED=false` permet de faire fonctionner l'ensemble de l'application en mode déconnecté (les PDF restent stockés localement et consultables dans l'application sans nécessiter de comptes tiers).

### 2. Démarrage de la stack Docker
Pour compiler et démarrer l'ensemble des conteneurs en tâche de fond :
```bash
docker compose up -d --build
```
Cette commande démarre :
1. **db** : PostgreSQL 16 sur le port `5432` (les données sont persistées dans le volume `pgdata`).
2. **api** : Le serveur Express sur le port `3000` (les fichiers temporaires et les backups de BDD sont persistés dans `apifiles`).
3. **web** : Le client nginx distribuant le bundle Vue.js sur le port `8080` et redirigeant le trafic `/api` vers le conteneur API.

### 3. Premier démarrage & Identifiants
Lors du premier lancement de l'API, la base de données est automatiquement migrée et un utilisateur administrateur est créé en utilisant les variables suivantes de votre fichier `.env` :
* **E-mail** : `ADMIN_EMAIL` (par défaut : `admin@example.com`)
* **Mot de passe** : `ADMIN_PASSWORD` (par défaut : `admin123` — **À modifier immédiatement dans le fichier `.env` avant le premier lancement**).

Une fois connecté, l'application vous redirigera automatiquement vers l'**assistant d'onboarding** pour initialiser vos paramètres d'entreprise.

---

## ⚙️ Commandes Utiles (Développement Local)

Si vous devez faire tourner des services localement ou gérer la base de données :

### 💾 Base de Données (Prisma)
Pour exécuter les migrations Prisma localement sur votre base Docker, assurez-vous d'avoir configuré le port de votre base de données sur `localhost` à la volée :
```bash
# Appliquer les migrations existantes en dev local
DATABASE_URL="postgresql://facturation:MON_MOT_DE_PASSE@localhost:5432/facturation?schema=public" npx prisma migrate dev

# Lancer la génération du client Prisma local (après un changement de schéma)
npm run prisma:generate

# Lancer le script de seeding
npm run db:seed
```

### 🗃️ Sauvegardes de la base de données
Les sauvegardes sont déclenchées par un cron hebdomadaire défini par `BACKUP_CRON` dans le `.env`. 
Vous pouvez également déclencher manuellement une sauvegarde via l'interface d'administration ou en appelant directement l'endpoint API dédié :
```bash
POST /api/admin/backup
```
Le backup effectue un `pg_dump`, génère un fichier compressé `.sql.gz` dans le volume local `/app/storage/backups` et le téléverse sur Google Drive (si activé).

---

## 📌 État du projet & Évolutions futures
L'application est activement développée en suivant le plan directeur (`plans/PLAN.md`).

* **Phase 0** : Socle infrastructure, base de données et services transverses (PDF, Drive, Mail). ➔ ✅ *Terminé*
* **Phase 1** : Gestion des factures, avoirs et encaissements. ➔ ✅ *Terminé*
* **Phase 2** : Gestion des devis, des avenants et édition enrichie. ➔ ✅ *Terminé*
* **Phase 3** : Gestion des contrats de maintenance et facturation mensuelle récurrente. ➔ ✅ *Terminé*
* **Phase 3.5** : Dashboard intelligent, fiche client 360° et relances directes. ➔ ✅ *Terminé*
* **Phase 4** : Pilotage comptable avancé (projections CA, génération du livre des recettes, déclarations URSSAF). ➔ ⬜ *À faire*
* **Phase 5** : Conformité 2026/2027 (Format Factur-X pour la facturation électronique obligatoire). ➔ ⬜ *À faire*
