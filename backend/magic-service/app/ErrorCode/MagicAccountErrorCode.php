<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 错误码范围:[4100, 4300].
 */
enum MagicAccountErrorCode: int
{
    // 登录类型不支持
    #[ErrorMessage('account.login_type_not_support')]
    case LOGIN_TYPE_NOT_SUPPORT = 4100;

    // 账号注册失败
    #[ErrorMessage('account.register_failed')]
    case REGISTER_FAILED = 4101;

    // 请求太频繁
    #[ErrorMessage('account.request_too_frequent')]
    case REQUEST_TOO_FREQUENT = 4102;

    // 不支持当前环境的登录
    #[ErrorMessage('account.login_env_not_support')]
    case LOGIN_ENV_NOT_SUPPORT = 4103;
}
