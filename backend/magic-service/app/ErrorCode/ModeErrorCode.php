<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 模式管理错误码范围:34000-34999.
 */
enum ModeErrorCode: int
{
    #[ErrorMessage('mode.validate_failed')]
    case VALIDATE_FAILED = 34000;

    #[ErrorMessage('mode.mode_not_found')]
    case MODE_NOT_FOUND = 34001;

    #[ErrorMessage('mode.mode_identifier_already_exists')]
    case MODE_IDENTIFIER_ALREADY_EXISTS = 34002;

    #[ErrorMessage('mode.group_not_found')]
    case GROUP_NOT_FOUND = 34003;

    #[ErrorMessage('mode.group_name_already_exists')]
    case GROUP_NAME_ALREADY_EXISTS = 34004;

    #[ErrorMessage('mode.invalid_distribution_type')]
    case INVALID_DISTRIBUTION_TYPE = 34005;

    #[ErrorMessage('mode.follow_mode_not_found')]
    case FOLLOW_MODE_NOT_FOUND = 34006;

    #[ErrorMessage('mode.cannot_follow_self')]
    case CANNOT_FOLLOW_SELF = 34007;

    #[ErrorMessage('mode.mode_in_use_cannot_delete')]
    case MODE_IN_USE_CANNOT_DELETE = 34008;
}
