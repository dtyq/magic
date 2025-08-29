# 🔐 Sistema di Gestione Permessi

Questo documento descrive come utilizzare il sistema di gestione permessi, che permette di concedere permessi specifici a utenti con numeri di cellulare specifici.

## Concetti Base

Il sistema di gestione permessi fornisce un modo semplice ma efficiente per controllare l'accesso a funzioni e interfacce specifiche. Il sistema include i seguenti concetti chiave:

1. **Amministratore Globale**: Utenti con accesso a tutte le funzioni
2. **Mappatura Permessi**: Mappatura di permessi specifici a liste di numeri di cellulare consentiti
3. **Modalità Rigorosa**: Un'opzione di configurazione che, quando abilitata, permette l'accesso solo a permessi configurati esplicitamente

# Permission Management System

This document describes how to use the permission management system, which allows granting specific permissions to specific mobile number users.

## Basic Concepts

The permission management system provides a simple yet efficient way to control access to specific functions and interfaces. The system includes the following key concepts:

1. **Global Administrator**: Users with access to all functions
2. **Permission Mapping**: Mapping of specific permissions to lists of allowed mobile numbers
3. **Strict Mode**: A configuration option that, when enabled, only allows access to explicitly configured permissions

## 🔑 Enumerazione Tipi di Permesso

Il sistema definisce la seguente enumerazione dei tipi di permesso (`SuperPermissionEnum`):

```php
enum SuperPermissionEnum: string
{
    // Global Administrator
    case GLOBAL_ADMIN = 'global_admin';

    // Flow Administrator
    case FLOW_ADMIN = 'flow_admin';

    // Assistant Administrator
    case ASSISTANT_ADMIN = 'assistant_admin';

    // Large Model Configuration Management
    case MODEL_CONFIG_ADMIN = 'model_config_admin';

    // Hide Department or User
    case HIDE_USER_OR_DEPT = 'hide_user_or_dept';

    // Privileged Message Sending
    case PRIVILEGE_SEND_MESSAGE = 'privilege_send_message';

    // Magic Environment Management
    case MAGIC_ENV_MANAGEMENT = 'magic_env_management';
    
    // Service Provider Administrator
    case SERVICE_PROVIDER_ADMIN = 'service_provider_admin';

    // Super Magic Invite Use User
    case SUPER_INVITE_USER = 'super_magic_invite_use_user';

    // Super Magic Board Administrator
    case SUPER_MAGIC_BOARD_ADMIN = 'super_magic_board_manager';

    // Super Magic Board Operator
    case SUPER_MAGIC_ BOARD_OPERATOR = 'super_magic_board_operator';
}
```

## Permission Type Enumeration

The system defines the following permission type enumeration (`SuperPermissionEnum`):

```php
enum SuperPermissionEnum: string
{
    // Global Administrator
    case GLOBAL_ADMIN = 'global_admin';

    // Flow Administrator
    case FLOW_ADMIN = 'flow_admin';

    // Assistant Administrator
    case ASSISTANT_ADMIN = 'assistant_admin';

    // Large Model Configuration Management
    case MODEL_CONFIG_ADMIN = 'model_config_admin';

    // Hide Department or User
    case HIDE_USER_OR_DEPT = 'hide_user_or_dept';

    // Privileged Message Sending
    case PRIVILEGE_SEND_MESSAGE = 'privilege_send_message';

    // Magic Environment Management
    case MAGIC_ENV_MANAGEMENT = 'magic_env_management';
    
    // Service Provider Administrator
    case SERVICE_PROVIDER_ADMIN = 'service_provider_admin';

    // Super Magic Invite Use User
    case SUPER_INVITE_USER = 'super_magic_invite_use_user';

    // Super Magic Board Administrator
    case SUPER_MAGIC_BOARD_ADMIN = 'super_magic_board_manager';

    // Super Magic Board Operator
    case SUPER_MAGIC_ BOARD_OPERATOR = 'super_magic_board_operator';
}
```

### 📋 Descrizioni Tipi di Permesso

| Enum Permesso | Valore Permesso | Descrizione |
|---------|-------|------|
| GLOBAL_ADMIN | 'global_admin' | Permesso amministratore globale, ha la massima autorità di sistema, può accedere a tutte le funzioni |
| FLOW_ADMIN | 'flow_admin' | Permesso amministratore flusso, può gestire e configurare flussi nel sistema |
| ASSISTANT_ADMIN | 'assistant_admin' | Permesso amministratore assistente, può gestire funzioni assistente nel sistema |
| MODEL_CONFIG_ADMIN | 'model_config_admin' | Permesso configurazione modello grande, può configurare e gestire impostazioni relative a modelli di linguaggio grandi |
| HIDE_USER_OR_DEPT | 'hide_user_or_dept' | Permesso nascondi utente o dipartimento, può nascondere utenti o dipartimenti specifici nel sistema |
| PRIVILEGE_SEND_MESSAGE | 'privilege_send_message' | Permesso invio messaggio privilegiato, può inviare tipi speciali di messaggi |
| MAGIC_ENV_MANAGEMENT | 'magic_env_management' | Permesso gestione ambiente magico, può gestire configurazione multi-ambiente |
| SERVICE_PROVIDER_ADMIN | 'service_provider_admin' | Permesso amministratore fornitore servizio, può gestire configurazione e funzioni relative al fornitore servizio |

### Permission Type Descriptions

| Permission Enum | Permission Value | Description |
|---------|-------|------|
| GLOBAL_ADMIN | 'global_admin' | Global administrator permission, has the highest system authority, can access all functions |
| FLOW_ADMIN | 'flow_admin' | Flow administrator permission, can manage and configure flows in the system |
| ASSISTANT_ADMIN | 'assistant_admin' | Assistant administrator permission, can manage assistant functions in the system |
| MODEL_CONFIG_ADMIN | 'model_config_admin' | Large model configuration permission, can configure and manage large language model related settings |
| HIDE_USER_OR_DEPT | 'hide_user_or_dept' | Hide user or department permission, can hide specific users or departments in the system |
| PRIVILEGE_SEND_MESSAGE | 'privilege_send_message' | Privileged message sending permission, can send special types of messages |
| MAGIC_ENV_MANAGEMENT | 'magic_env_management' | Magic environment management permission, can manage multi-environment configuration |
| SERVICE_PROVIDER_ADMIN | 'service_provider_admin' | Service provider administrator permission, can manage service provider related configuration and functions |

## ⚙️ File di Configurazione

Il sistema di permessi è principalmente gestito attraverso un file di configurazione situato in: `config/autoload/permission.php`

### Descrizione Elementi Configurazione

```php
<?php

return [
    // Permission configuration
    // Format: 'permission' => ['mobile1', 'mobile2', ...]
    'permissions' => Json::decode(env('PERMISSIONS', '[]')),
];
```

### Configurazione Variabile Ambiente

Il sistema supporta configurazione attraverso variabili ambiente, migliorando la flessibilità di deployment:

```
# Permission system configuration
PERMISSIONS={"flow_admin":["13800000000","13900000000"]}
```

## Configuration File

The permission system is primarily managed through a configuration file located at: `config/autoload/permission.php`

### Configuration Item Description

```php
<?php

return [
    // Permission configuration
    // Format: 'permission' => ['mobile1', 'mobile2', ...]
    'permissions' => Json::decode(env('PERMISSIONS', '[]')),
];
```

### Environment Variable Configuration

The system supports configuration through environment variables, improving deployment flexibility:

```
# Permission system configuration
PERMISSIONS={"flow_admin":["13800000000","13900000000"]}
```

## 📏 Regole Abbinamento Permessi

L'abbinamento permessi segue queste regole:

1. Prima controlla se l'utente è un amministratore globale, se sì, permette accesso a tutti i permessi
2. Se non è amministratore globale, controlla se l'utente ha il permesso specifico richiesto

## Permission Matching Rules

Permission matching follows these rules:

1. First check if the user is a global administrator, if yes, allow access to all permissions
2. If not a global administrator, check if the user has the requested specific permission

## 💻 Utilizzo nel Codice
### Verifica Permesso Manuale

In alcuni casi speciali, potresti aver bisogno di controllare permessi manualmente nel codice:

```php
use App\Infrastructure\Util\Auth\PermissionChecker;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\ErrorCode\GenericErrorCode;
use App\Application\Kernel\SuperPermissionEnum;

class YourClass
{
    public function __construct(
        private readonly PermissionChecker $permissionChecker,
    ) {
    }
    
    public function yourMethod(RequestInterface $request)
    {
        $authorization = $this->getAuthorization();
        $mobile = $authorization->getMobile();
        
        if (!PermissionChecker::mobileHasPermission($mobile, SuperPermissionEnum::FLOW_ADMIN)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
        }
        
        // Execute subsequent business logic...
    }
}
```

### Utilizzo Tipi Enumerazione Permessi

Il sistema fornisce il tipo enumerazione permessi `PermissionEnum` per definire e controllare vari permessi:

```php
use App\Application\Kernel\SuperPermissionEnum;
use App\Infrastructure\Util\Auth\PermissionChecker;

// Check if user has global administrator permission
$hasGlobalAdmin = PermissionChecker::mobileHasPermission($mobile, SuperPermissionEnum::GLOBAL_ADMIN);

// Check if user has flow administrator permission
$hasFlowAdmin = PermissionChecker::mobileHasPermission($mobile, SuperPermissionEnum::FLOW_ADMIN);

// Check if user has assistant administrator permission
$hasAssistantAdmin = PermissionChecker::mobileHasPermission($mobile, SuperPermissionEnum::ASSISTANT_ADMIN);
```

## Using in Code
### Manual Permission Verification

In some special cases, you may need to manually check permissions in the code:

```php
use App\Infrastructure\Util\Auth\PermissionChecker;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\ErrorCode\GenericErrorCode;
use App\Application\Kernel\SuperPermissionEnum;

class YourClass
{
    public function __construct(
        private readonly PermissionChecker $permissionChecker,
    ) {
    }
    
    public function yourMethod(RequestInterface $request)
    {
        $authorization = $this->getAuthorization();
        $mobile = $authorization->getMobile();
        
        if (!PermissionChecker::mobileHasPermission($mobile, SuperPermissionEnum::FLOW_ADMIN)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
        }
        
        // Execute subsequent business logic...
    }
}
```

### Using Permission Enumeration Types

The system provides the permission enumeration type `PermissionEnum` for defining and checking various permissions:

```php
use App\Application\Kernel\SuperPermissionEnum;
use App\Infrastructure\Util\Auth\PermissionChecker;

// Check if user has global administrator permission
$hasGlobalAdmin = PermissionChecker::mobileHasPermission($mobile, SuperPermissionEnum::GLOBAL_ADMIN);

// Check if user has flow administrator permission
$hasFlowAdmin = PermissionChecker::mobileHasPermission($mobile, SuperPermissionEnum::FLOW_ADMIN);

// Check if user has assistant administrator permission
$hasAssistantAdmin = PermissionChecker::mobileHasPermission($mobile, SuperPermissionEnum::ASSISTANT_ADMIN);
```

## 🧪 Test

Il sistema fornisce test unitari, che puoi eseguire con il seguente comando:

```bash
vendor/bin/phpunit test/Cases/Infrastructure/Util/Auth/PermissionCheckerTest.php
```

I test coprono i seguenti aspetti:

1. Controllo Permesso Amministratore Globale - Verifica che amministratori globali possano accedere a tutti i permessi
2. Controllo Permesso Specifico - Verifica controllo accesso utente per permessi specifici
3. Scenario Senza Permesso - Verifica che utenti non autorizzati siano correttamente negati
4. Vari Casi Limite - Gestisce casi eccezionali come numeri cellulare vuoti

## Testing

The system provides unit tests, which you can run with the following command:

```bash
vendor/bin/phpunit test/Cases/Infrastructure/Util/Auth/PermissionCheckerTest.php
```

Tests cover the following aspects:

1. Global Administrator Permission Check - Verify global administrators can access all permissions
2. Specific Permission Check - Verify user access control for specific permissions
3. No Permission Scenario - Verify unauthorized users are correctly denied
4. Various Edge Cases - Handle exceptional cases such as empty mobile numbers

## 💡 Raccomandazioni Utilizzo

1. Configura permessi appropriati per diversi livelli di funzionalità per garantire sicurezza di caratteristiche critiche
2. Configura amministratori globali appropriati per ambienti di sviluppo e test per facilitare sviluppo e test
3. Considera abilitare modalità rigorosa in ambienti di produzione per migliorare sicurezza
4. Audita regolarmente configurazioni permessi e rimuovi permessi non necessari
5. Usa variabili ambiente per configurare permessi per aggiustamento flessibile attraverso ambienti diversi
6. Evita aggiungere troppi utenti a liste permessi per mantenere semplicità ed efficienza nella gestione permessi

## Usage Recommendations

1. Configure appropriate permissions for different levels of functionality to ensure security of critical features
2. Configure appropriate global administrators for development and testing environments to facilitate development and testing
3. Consider enabling strict mode in production environments to improve security
4. Regularly audit permission configurations and remove unnecessary permissions
5. Use environment variables to configure permissions for flexible adjustment across different environments
6. Avoid adding too many users to permission lists to maintain simplicity and efficiency in permission management

# 📄 Valore Variabile Ambiente PERMISSIONS

```json
{
  "global_admin": ["13800000001", "13800000002"],
  "flow_admin": ["13800000003", "13800000004", "13800000005"],
  "assistant_admin": ["13800000006", "13800000007"],
  "model_config_admin": ["13800000008", "13800000009"],
  "hide_user_or_dept": ["13800000010", "13800000011"],
  "privilege_send_message": ["13800000012", "13800000013"],
  "magic_env_management": ["13800000014", "13800000015"],
  "service_provider_admin": ["13800000016", "13800000017"]
}
```

# PERMISSIONS Environment Variable Value

```json
{
  "global_admin": ["13800000001", "13800000002"],
  "flow_admin": ["13800000003", "13800000004", "13800000005"],
  "assistant_admin": ["13800000006", "13800000007"],
  "model_config_admin": ["13800000008", "13800000009"],
  "hide_user_or_dept": ["13800000010", "13800000011"],
  "privilege_send_message": ["13800000012", "13800000013"],
  "magic_env_management": ["13800000014", "13800000015"],
  "service_provider_admin": ["13800000016", "13800000017"]
}
```