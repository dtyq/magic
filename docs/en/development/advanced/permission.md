# Permission Management System

This document describes how to use the permission management system, which allows granting specific permissions to specific mobile number users.

## Basic Concepts

The permission management system provides a simple yet efficient way to control access to specific functions and interfaces. The system includes the following key concepts:

1. **Global Administrator**: Users with access to all functions
2. **Permission Mapping**: Mapping of specific permissions to lists of allowed mobile numbers
3. **Strict Mode**: A configuration option that, when enabled, only allows access to explicitly configured permissions

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

## Permission Matching Rules

Permission matching follows these rules:

1. First check if the user is a global administrator, if yes, allow access to all permissions
2. If not a global administrator, check if the user has the requested specific permission

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

## Usage Recommendations

1. Configure appropriate permissions for different levels of functionality to ensure security of critical features
2. Configure appropriate global administrators for development and testing environments to facilitate development and testing
3. Consider enabling strict mode in production environments to improve security
4. Regularly audit permission configurations and remove unnecessary permissions
5. Use environment variables to configure permissions for flexible adjustment across different environments
6. Avoid adding too many users to permission lists to maintain simplicity and efficiency in permission management

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