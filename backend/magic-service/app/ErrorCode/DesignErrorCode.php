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

    #[ErrorMessage('design.html_design_style.invalid_style_code')]
    case InvalidStyleCode = 14002;

    #[ErrorMessage('design.html_design_style.style_source_not_found')]
    case StyleSourceNotFound = 14003;

    #[ErrorMessage('design.html_design_style.style_source_read_failed')]
    case StyleSourceReadFailed = 14004;
}
