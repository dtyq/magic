# 权限管理系统

本文档描述了如何使用权限管理系统，该系统允许将特定权限授权给特定手机号用户。

## 基本概念

权限管理系统提供了一种简单但高效的方式来控制对特定功能和接口的访问。系统包含以下几个关键概念：

1. **全局管理员**：有权访问所有功能的用户
2. **权限映射**：特定权限到允许访问的手机号列表的映射
3. **严格模式**：一种配置选项，启用后只有显式配置了的权限才能被访问

## 权限类型枚举

系统定义了以下权限类型枚举（`SuperPermissionEnum`）：

```php
enum SuperPermissionEnum: string
{
    // 全局管理员
    case GLOBAL_ADMIN = 'global_admin';

    // 流程管理员
    case FLOW_ADMIN = 'flow_admin';

    // 助理管理员
    case ASSISTANT_ADMIN = 'assistant_admin';

    // 大模型配置管理
    case MODEL_CONFIG_ADMIN = 'model_config_admin';

    // 隐藏部门或者用户
    case HIDE_USER_OR_DEPT = 'hide_user_or_dept';

    // 特权发消息
    case PRIVILEGE_SEND_MESSAGE = 'privilege_send_message';

    // 麦吉多环境管理
    case MAGIC_ENV_MANAGEMENT = 'magic_env_management';
    
    // 服务商的管理员
    case SERVICE_PROVIDER_ADMIN = 'service_provider_admin';

    // 超级麦吉邀请使用用户
    case SUPER_INVITE_USER = 'super_magic_invite_use_user';

    // 超级麦吉看板管理人员
    case SUPER_MAGIC_BOARD_ADMIN = 'super_magic_board_manager';

    // 超级麦吉看板运营人员
    case SUPER_MAGIC_ BOARD_OPERATOR = 'super_magic_board_operator';
}
```

### 权限类型说明

| 权限枚举 | 权限值 | 描述 |
|---------|-------|------|
| GLOBAL_ADMIN | 'global_admin' | 全局管理员权限，具有系统最高权限，可以访问所有功能 |
| FLOW_ADMIN | 'flow_admin' | 流程管理员权限，可以管理和配置系统中的流程 |
| ASSISTANT_ADMIN | 'assistant_admin' | 助理管理员权限，可以管理系统中的助理功能 |
| MODEL_CONFIG_ADMIN | 'model_config_admin' | 大模型配置权限，可以配置和管理大语言模型相关设置 |
| HIDE_USER_OR_DEPT | 'hide_user_or_dept' | 隐藏用户或部门权限，可以在系统中隐藏特定用户或部门 |
| PRIVILEGE_SEND_MESSAGE | 'privilege_send_message' | 特权发消息权限，可以发送特殊类型的消息 |
| MAGIC_ENV_MANAGEMENT | 'magic_env_management' | 麦吉多环境管理权限，可以管理多环境配置 |
| SERVICE_PROVIDER_ADMIN | 'service_provider_admin' | 服务商管理员权限，可以管理服务商相关配置和功能 |

## 配置文件

权限系统主要通过配置文件进行管理，配置文件位于：`config/autoload/permission.php`

### 配置项说明

```php
<?php

return [
    // 权限配置
    // 格式为：'权限' => ['手机号1', '手机号2', ...]
    'permissions' => Json::decode(env('PERMISSIONS', '[]')),
];
```

### 环境变量配置

系统支持通过环境变量进行配置，提高了部署的灵活性：

```
# 权限系统配置
PERMISSIONS={"flow_admin":["13800000000","13900000000"]}
```

## 权限匹配规则

权限匹配按照以下规则进行：

1. 先检查用户是否是全局管理员，如果是，则允许访问所有权限
2. 如果不是全局管理员，检查用户是否具有请求的特定权限

## 在代码中使用
### 手动校验权限

在某些特殊情况下，您可能需要在代码中手动检查权限：

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
        
        // 执行后续业务逻辑...
    }
}
```

### 使用权限枚举类型

系统提供了权限枚举类型 `PermissionEnum`，用于定义和检查各种权限：

```php
use App\Application\Kernel\SuperPermissionEnum;
use App\Infrastructure\Util\Auth\PermissionChecker;

// 检查用户是否有全局管理员权限
$hasGlobalAdmin = PermissionChecker::mobileHasPermission($mobile, SuperPermissionEnum::GLOBAL_ADMIN);

// 检查用户是否有流程管理员权限
$hasFlowAdmin = PermissionChecker::mobileHasPermission($mobile, SuperPermissionEnum::FLOW_ADMIN);

// 检查用户是否有助理管理员权限
$hasAssistantAdmin = PermissionChecker::mobileHasPermission($mobile, SuperPermissionEnum::ASSISTANT_ADMIN);
```

## 测试

系统提供了单元测试，您可以通过以下命令运行测试：

```bash
vendor/bin/phpunit test/Cases/Infrastructure/Util/Auth/PermissionCheckerTest.php
```

测试包括以下几个方面：

1. 全局管理员权限检查 - 验证全局管理员能够访问所有权限
2. 特定权限检查 - 验证用户对特定权限的访问控制
3. 无权限情况 - 验证未授权用户被正确拒绝
4. 各种边缘情况 - 如空手机号等异常情况的处理

## 使用建议

1. 为不同级别的功能配置适当的权限，确保关键功能的安全性
2. 为开发和测试环境配置适当的全局管理员，方便开发和测试
3. 在生产环境中考虑启用严格模式，提高安全性
4. 定期审核权限配置，移除不再需要的权限
5. 使用环境变量配置权限，便于在不同环境中灵活调整权限设置
6. 避免在权限列表中添加过多用户，保持权限管理的简洁和高效 

# PERMISSIONS 环境变量值

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
