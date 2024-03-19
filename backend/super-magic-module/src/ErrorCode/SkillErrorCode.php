<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 错误码范围:51239-51338 (100个).
 */
enum SkillErrorCode: int
{
    #[ErrorMessage('skill.import_concurrent_error')]
    case IMPORT_CONCURRENT_ERROR = 51239;

    #[ErrorMessage('skill.invalid_file_format')]
    case INVALID_FILE_FORMAT = 51240;

    #[ErrorMessage('skill.file_too_large')]
    case FILE_TOO_LARGE = 51241;

    #[ErrorMessage('skill.extracted_file_too_large')]
    case EXTRACTED_FILE_TOO_LARGE = 51242;

    #[ErrorMessage('skill.skill_json_not_supported')]
    case SKILL_JSON_NOT_SUPPORTED = 51243;

    #[ErrorMessage('skill.skill_md_not_found')]
    case SKILL_MD_NOT_FOUND = 51244;

    #[ErrorMessage('skill.skill_md_read_failed')]
    case SKILL_MD_READ_FAILED = 51245;

    #[ErrorMessage('skill.package_name_required')]
    case PACKAGE_NAME_REQUIRED = 51246;

    #[ErrorMessage('skill.invalid_package_name_format')]
    case INVALID_PACKAGE_NAME_FORMAT = 51247;

    #[ErrorMessage('skill.invalid_import_token')]
    case INVALID_IMPORT_TOKEN = 51248;

    #[ErrorMessage('skill.import_token_expired')]
    case IMPORT_TOKEN_EXPIRED = 51249;

    #[ErrorMessage('skill.skill_version_not_found')]
    case SKILL_VERSION_NOT_FOUND = 51250;

    #[ErrorMessage('skill.file_upload_failed')]
    case FILE_UPLOAD_FAILED = 51251;

    #[ErrorMessage('skill.code')]
    case CODE = 51252;

    #[ErrorMessage('skill.extracted_directory_not_found')]
    case EXTRACTED_DIRECTORY_NOT_FOUND = 51253;

    #[ErrorMessage('skill.extracted_directory_name_mismatch')]
    case EXTRACTED_DIRECTORY_NAME_MISMATCH = 51254;

    #[ErrorMessage('skill.file_download_failed')]
    case FILE_DOWNLOAD_FAILED = 51255;

    #[ErrorMessage('skill.file_not_found')]
    case FILE_NOT_FOUND = 51256;

    #[ErrorMessage('skill.skill_not_found')]
    case SKILL_NOT_FOUND = 51257;

    #[ErrorMessage('skill.store_skill_cannot_update')]
    case STORE_SKILL_CANNOT_UPDATE = 51258;

    #[ErrorMessage('skill.store_skill_cannot_publish')]
    case STORE_SKILL_CANNOT_PUBLISH = 51259;

    #[ErrorMessage('skill.no_published_version')]
    case NO_PUBLISHED_VERSION = 51260;

    #[ErrorMessage('skill.cannot_review_version')]
    case CANNOT_REVIEW_VERSION = 51261;

    #[ErrorMessage('skill.invalid_review_action')]
    case INVALID_REVIEW_ACTION = 51262;

    #[ErrorMessage('skill.skill_access_denied')]
    case SKILL_ACCESS_DENIED = 51263;

    #[ErrorMessage('skill.store_skill_not_found')]
    case STORE_SKILL_NOT_FOUND = 51264;

    #[ErrorMessage('skill.store_skill_already_added')]
    case STORE_SKILL_ALREADY_ADDED = 51265;

    #[ErrorMessage('skill.skill_already_latest_version')]
    case SKILL_ALREADY_LATEST_VERSION = 51266;

    #[ErrorMessage('skill.non_store_skill_cannot_upgrade')]
    case NON_STORE_SKILL_CANNOT_UPGRADE = 51267;

    #[ErrorMessage('skill.skill_source_type_error')]
    case SKILL_SOURCE_TYPE_ERROR = 51268;
}
