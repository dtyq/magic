<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel;

/**
 * 跨组织的超级权限枚举类.
 */
enum SuperPermissionEnum: string
{
    // 全局管理员
    case GLOBAL_ADMIN = 'global_admin';

    // 流程管理员,目前只有 queryToolSets 用到
    case FLOW_ADMIN = 'flow_admin';

    // （第三方平台的）助理管理员
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
    case SUPER_MAGIC_BOARD_OPERATOR = 'super_magic_board_operator';
}
