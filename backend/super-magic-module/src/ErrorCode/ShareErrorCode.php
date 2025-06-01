<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 错误码范围:51300-51400.
 */
enum ShareErrorCode: int
{
    #[ErrorMessage('share.parameter_check_failure')]
    case PARAMETER_CHECK_FAILURE = 51300;

    #[ErrorMessage('share.resource_type_not_supported')]
    case RESOURCE_TYPE_NOT_SUPPORTED = 51301;

    #[ErrorMessage('share.resource_not_found')]
    case RESOURCE_NOT_FOUND = 51302;

    #[ErrorMessage('share.permission_denied')]
    case PERMISSION_DENIED = 51303;

    #[ErrorMessage('share.operation_failed')]
    case OPERATION_FAILED = 51304;

    #[ErrorMessage('share.not_found')]
    case NOT_FOUND = 51305;

    #[ErrorMessage('share.password_error')]
    case PASSWORD_ERROR = 51306;

    #[ErrorMessage('share.create_resources_error')]
    case CREATE_RESOURCES_ERROR = 51307;
}
