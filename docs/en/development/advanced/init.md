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