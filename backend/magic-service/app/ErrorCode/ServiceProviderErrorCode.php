<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

enum ServiceProviderErrorCode: int
{
    #[ErrorMessage('service_provider.system_error')]
    case SystemError = 44000;

    #[ErrorMessage('service_provider.model_not_found')]
    case ModelNotFound = 44001;

    #[ErrorMessage('service_provider.invalid_model_type')]
    case InvalidModelType = 44002;

    #[ErrorMessage('service_provider.service_provider_not_found')]
    case ServiceProviderNotFound = 44003;

    #[ErrorMessage('service_provider.service_provider_config_error')]
    case ServiceProviderConfigError = 44004;

    #[ErrorMessage('service_provider.response_parse_error')]
    case ResponseParseError = 44006;

    #[ErrorMessage('service_provider.quota_exceeded')]
    case QuotaExceeded = 440007;

    #[ErrorMessage('service_provider.invalid_parameter')]
    case InvalidParameter = 44008;

    #[ErrorMessage('service_provider.model_not_active')]
    case ModelNotActive = 44009;

    #[ErrorMessage('service_provider.service_provider_not_active')]
    case ServiceProviderNotActive = 44010;

    #[ErrorMessage('service_provider.model_officially_disabled')]
    case ModelOfficiallyDisabled = 44011;

    #[ErrorMessage('service_provider.magic_provider_not_found')]
    case MagicProviderNotFound = 44012;

    #[ErrorMessage('service_provider.model_operation_locked')]
    case ModelOperationLocked = 44013;

    #[ErrorMessage('service_provider.invalid_pricing')]
    case InvalidPricing = 44014;
}
