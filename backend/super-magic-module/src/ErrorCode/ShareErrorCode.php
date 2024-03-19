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

    #[ErrorMessage('share.vip_required_for_password')]
    case VIP_REQUIRED_FOR_PASSWORD = 51308;

    #[ErrorMessage('share.vip_required_for_show_original_info')]
    case VIP_REQUIRED_FOR_SHOW_ORIGINAL_INFO = 51309;

    #[ErrorMessage('share.vip_required_for_hide_created_by_super_magic')]
    case VIP_REQUIRED_FOR_HIDE_CREATED_BY_SUPER_MAGIC = 51310;

    #[ErrorMessage('share.invalid_extra_field')]
    case INVALID_EXTRA_FIELD = 51311;

    #[ErrorMessage('share.copy_project_files_not_allowed')]
    case COPY_PROJECT_FILES_NOT_ALLOWED = 51312;

    #[ErrorMessage('share.target_ids_required')]
    case TARGET_IDS_REQUIRED = 51313;

    #[ErrorMessage('share.share_project_only_for_file_collection')]
    case SHARE_PROJECT_ONLY_FOR_FILE_COLLECTION = 51314;

    #[ErrorMessage('share.project_not_found_for_share_project')]
    case PROJECT_NOT_FOUND_FOR_SHARE_PROJECT = 51315;

    #[ErrorMessage('share.file_ids_required_for_file_collection')]
    case FILE_IDS_REQUIRED_FOR_FILE_COLLECTION = 51316;

    #[ErrorMessage('share.password_required_for_password_protected')]
    case PASSWORD_REQUIRED = 51317;

    #[ErrorMessage('share.download_not_allowed')]
    case DOWNLOAD_NOT_ALLOWED = 51318;
}
