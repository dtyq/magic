<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * DataQuery 错误码范围: 4100-4199.
 */
enum DataQueryErrorCode: int
{
    #[ErrorMessage(message: 'data_query.location_required')]
    case LOCATION_REQUIRED = 4100;

    #[ErrorMessage(message: 'data_query.driver_not_configured')]
    case DRIVER_NOT_CONFIGURED = 4101;

    #[ErrorMessage(message: 'data_query.driver_not_available')]
    case DRIVER_NOT_AVAILABLE = 4102;

    #[ErrorMessage(message: 'data_query.request_failed')]
    case REQUEST_FAILED = 4103;

    #[ErrorMessage(message: 'data_query.invalid_response')]
    case INVALID_RESPONSE = 4104;
}
