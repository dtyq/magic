# 🚀 Guida all'Inizializzazione del Sistema Magic Service

Questo documento descrive brevemente i passaggi di inizializzazione per il sistema Magic Service, inclusa la popolazione di dati account e utente, la configurazione dell'ambiente e l'implementazione della funzionalità di verifica del login.

## 1. 👥 Inizializzazione Dati Account e Utente

Il sistema utilizza il seeder di dati `seeders/initial_account_and_user_seeder.php` per inizializzare i dati account e utente, principalmente per compiere le seguenti attività:

- Creare almeno 2 record di account umani nella tabella `magic_contact_accounts`
- Creare dati utente per ciascun account sotto 2 diverse organizzazioni
- Utilizzare `App\Infrastructure\Util\IdGenerator` per generare automaticamente magic_id
- Implementare il controllo di dati duplicati per evitare creazioni duplicate

## 2. ⚙️ Inizializzazione Configurazione Ambiente

Il sistema utilizza il seeder di dati `seeders/initial_environment_seeder.php` per inizializzare i dati di configurazione dell'ambiente, principalmente per compiere le seguenti attività:

- Scrivere la configurazione dell'ambiente di produzione, inclusi tipo di deployment, tipo di ambiente, configurazione privata, ecc.
- Scrivere la configurazione dell'ambiente di test per scopi di sviluppo e test

> **Importante:** L'ID dell'ambiente di produzione del sistema è 10000. Assicurati che `MAGIC_ENV_ID` sia impostato su `10000` nelle variabili d'ambiente.

## 4. 🔄 Passaggi di Esecuzione e Test

### 4.1 Esegui Seeding Dati

Esegui i seguenti comandi per popolare i dati account e ambiente:

```bash
php bin/hyperf.php db:seed --path=seeders/initial_account_and_user_seeder.php
php bin/hyperf.php db:seed --path=seeders/initial_environment_seeder.php
```

### 4.2 Riavvia Servizio

Carica la nuova configurazione delle route:

```bash
php bin/hyperf.php server:restart
```

### 4.3 Testa Funzionalità Login

Utilizza il seguente comando per testare l'interfaccia di login:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"138001","organization_code":""}' http://localhost:9501/api/v1/login/check
```

## 5. 🔐 Informazioni Password

Account predefiniti e password:

- Account `13812345678`: Password è `letsmagic.ai`
- Account `13912345678`: Password è `letsmagic.ai`

Negli ambienti di produzione, assicurati l'implementazione di meccanismi sicuri di archiviazione e verifica delle password.

---

# Magic Service System Initialization Guide

This document briefly describes the initialization steps for the Magic Service system, including account and user data population, environment configuration, and login verification functionality implementation.

## 1. Account and User Data Initialization

The system uses the data seeder `seeders/initial_account_and_user_seeder.php` to initialize account and user data, mainly accomplishing the following tasks:

- Create at least 2 human account records in the `magic_contact_accounts` table
- Create user data for each account under 2 different organizations
- Use `App\Infrastructure\Util\IdGenerator` to automatically generate magic_id
- Implement duplicate data checking to avoid duplicate creation

## 2. Environment Configuration Initialization

The system uses the data seeder `seeders/initial_environment_seeder.php` to initialize environment configuration data, mainly accomplishing the following tasks:

- Write production environment configuration, including deployment type, environment type, private configuration, etc.
- Write test environment configuration for development and testing purposes

> **Important:** The system production environment ID is 10000. Please ensure that `MAGIC_ENV_ID` is set to `10000` in the environment variables.

## 4. Execution and Testing Steps

### 4.1 Run Data Seeding

Execute the following commands to populate account and environment data:

```bash
php bin/hyperf.php db:seed --path=seeders/initial_account_and_user_seeder.php
php bin/hyperf.php db:seed --path=seeders/initial_environment_seeder.php
```

### 4.2 Restart Service

Load new route configuration:

```bash
php bin/hyperf.php server:restart
```

### 4.3 Test Login Functionality

Use the following command to test the login interface:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"138001","organization_code":""}' http://localhost:9501/api/v1/login/check
```

## 5. Password Information

Default Accounts and password:

- Account `13812345678`: Password is `letsmagic.ai`
- Account `13912345678`: Password is `letsmagic.ai`

In production environments, please ensure the implementation of secure password storage and verification mechanisms.