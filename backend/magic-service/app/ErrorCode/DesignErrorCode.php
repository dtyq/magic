<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * Design 领域错误码
 */
enum DesignErrorCode: int
{
    #[ErrorMessage('common.validate_failed')]
    case InvalidArgument = 14000;

    #[ErrorMessage('design.third_party_service_error')]
    case ThirdPartyServiceError = 14001;
}
