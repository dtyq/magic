<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

enum HttpErrorCode: int
{
    #[ErrorMessage(message: 'common.invalid_token')]
    case Unauthorized = 403;
}
