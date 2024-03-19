<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 错误码范围: 46000-46999.
 */
enum AppMenuErrorCode: int
{
    #[ErrorMessage('app_menu.not_found')]
    case NotFound = 46001;

    #[ErrorMessage('app_menu.id_required_for_update')]
    case IdRequiredForUpdate = 46002;
}
