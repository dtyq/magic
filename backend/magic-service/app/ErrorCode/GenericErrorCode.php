<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

enum GenericErrorCode: int
{
    #[ErrorMessage('system_exception')]
    case SystemError = 5000;

    #[ErrorMessage('parameter_missing')]
    case ParameterMissing = 5001;

    #[ErrorMessage('illegal_operation')]
    case IllegalOperation = 5002;

    #[ErrorMessage('parameter_validation_error')]
    case ParameterValidationFailed = 5003;

    #[ErrorMessage('access_denied')]
    case AccessDenied = 5004;

    #[ErrorMessage('basic_service_interface_exception')]
    case BasicServiceInterfaceException = 5005;

    #[ErrorMessage('not_implemented')]
    case NotImplemented = 5006;

    #[ErrorMessage('common.too_many_requests')]
    case TooManyRequests = 5007;
}
