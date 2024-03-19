<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

enum AuthenticationErrorCode: int
{
    #[ErrorMessage(message: 'common.error')]
    case Error = 33000;

    #[ErrorMessage(message: 'common.validate_failed')]
    case ValidateFailed = 33001;

    #[ErrorMessage(message: 'authentication.account_not_found')]
    case AccountNotFound = 33002;

    #[ErrorMessage(message: 'authentication.password_error')]
    case PasswordError = 33003;

    #[ErrorMessage(message: 'authentication.user_not_found')]
    case UserNotFound = 33004;

    #[ErrorMessage(message: 'authentication.personal_access_token_already_exists')]
    case PersonalAccessTokenAlreadyExists = 33006;
}
