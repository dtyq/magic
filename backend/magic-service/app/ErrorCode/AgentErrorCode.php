<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 错误码范围:33000-33999.
 */
enum AgentErrorCode: int
{
    #[ErrorMessage('agent.parameter_check_failure')]
    case VALIDATE_FAILED = 32000;

    #[ErrorMessage('agent.version_can_only_be_enabled_after_approval')]
    case VERSION_CAN_ONLY_BE_ENABLED_AFTER_APPROVAL = 32001;

    #[ErrorMessage('agent.version_can_only_be_disabled_after_enabled')]
    case VERSION_ONLY_ENABLED_CAN_BE_DISABLED = 32002;

    #[ErrorMessage('agent.create_group_user_not_exist')]
    case CREATE_GROUP_USER_NOT_EXIST = 32003;

    #[ErrorMessage('agent.create_group_user_account_not_exist')]
    case CREATE_GROUP_USER_ACCOUNT_NOT_EXIST = 32004;

    #[ErrorMessage('agent.get_third_platform_user_id_failed')]
    case GET_THIRD_PLATFORM_USER_ID_FAILED = 32005;

    #[ErrorMessage('agent.agent_not_found')]
    case AGENT_NOT_FOUND = 32006;

    #[ErrorMessage('agent.sandbox_not_found')]
    case SANDBOX_NOT_FOUND = 32007;

    #[ErrorMessage('agent.sandbox_upgrade_failed')]
    case SANDBOX_UPGRADE_FAILED = 32008;
}
