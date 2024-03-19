<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

enum PermissionErrorCode: int
{
    #[ErrorMessage(message: 'permission.error')]
    case Error = 42000;

    #[ErrorMessage(message: 'permission.validate_failed')]
    case ValidateFailed = 42001;

    #[ErrorMessage(message: 'permission.business_exception')]
    case BusinessException = 42002;

    #[ErrorMessage(message: 'permission.access_denied')]
    case AccessDenied = 42003;

    // 组织相关错误码
    #[ErrorMessage(message: 'permission.organization_code_required')]
    case ORGANIZATION_CODE_REQUIRED = 42100;

    #[ErrorMessage(message: 'permission.organization_name_required')]
    case ORGANIZATION_NAME_REQUIRED = 42101;

    #[ErrorMessage(message: 'permission.organization_industry_type_required')]
    case ORGANIZATION_INDUSTRY_TYPE_REQUIRED = 42102;

    #[ErrorMessage(message: 'permission.organization_seats_invalid')]
    case ORGANIZATION_SEATS_INVALID = 42103;

    #[ErrorMessage(message: 'permission.organization_code_exists')]
    case ORGANIZATION_CODE_EXISTS = 42104;

    #[ErrorMessage(message: 'permission.organization_name_exists')]
    case ORGANIZATION_NAME_EXISTS = 42105;

    #[ErrorMessage(message: 'permission.organization_not_exists')]
    case ORGANIZATION_NOT_EXISTS = 42106;

    // 资源可见性相关错误码
    #[ErrorMessage(message: 'permission.error.visibility_config_invalid')]
    case VISIBILITY_CONFIG_INVALID = 42200;

    #[ErrorMessage(message: 'permission.error.only_organization_admin_can_configure_visibility')]
    case ONLY_ADMIN_CAN_CONFIGURE_VISIBILITY = 42201;

    #[ErrorMessage(message: 'permission.error.visibility_type_2_requires_users_or_departments')]
    case VISIBILITY_TYPE_2_REQUIRES_USERS_OR_DEPARTMENTS = 42202;
}
