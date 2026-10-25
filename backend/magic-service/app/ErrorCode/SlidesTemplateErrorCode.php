<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 幻灯片模板错误码范围：47000-47999.
 */
enum SlidesTemplateErrorCode: int
{
    #[ErrorMessage('slides_template.validate_failed')]
    case VALIDATE_FAILED = 47000;

    #[ErrorMessage('slides_template.only_official_organization_can_manage')]
    case ONLY_OFFICIAL_ORGANIZATION_CAN_MANAGE = 47001;

    #[ErrorMessage('slides_template.not_found')]
    case TEMPLATE_NOT_FOUND = 47002;

    #[ErrorMessage('slides_template.code_generate_failed')]
    case CODE_GENERATE_FAILED = 47003;

    #[ErrorMessage('slides_template.file_url_generate_failed')]
    case FILE_URL_GENERATE_FAILED = 47004;

    #[ErrorMessage('slides_template.code_already_exists')]
    case CODE_ALREADY_EXISTS = 47005;

    #[ErrorMessage('slides_template.category_not_found')]
    case CATEGORY_NOT_FOUND = 47006;

    #[ErrorMessage('slides_template.category_code_already_exists')]
    case CATEGORY_CODE_ALREADY_EXISTS = 47007;

    #[ErrorMessage('slides_template.tag_not_found')]
    case TAG_NOT_FOUND = 47008;

    #[ErrorMessage('slides_template.tag_code_already_exists')]
    case TAG_CODE_ALREADY_EXISTS = 47009;

    #[ErrorMessage('slides_template.tag_structure_invalid')]
    case TAG_STRUCTURE_INVALID = 47010;

    #[ErrorMessage('slides_template.tag_group_cannot_bind')]
    case TAG_GROUP_CANNOT_BIND = 47011;

    #[ErrorMessage('slides_template.user_template_access_denied')]
    case USER_TEMPLATE_ACCESS_DENIED = 47012;

    #[ErrorMessage('slides_template.template_disabled_cannot_use')]
    case TEMPLATE_DISABLED_CANNOT_USE = 47013;

    #[ErrorMessage('slides_template.category_not_official')]
    case CATEGORY_NOT_OFFICIAL = 47014;

    #[ErrorMessage('slides_template.tag_not_official')]
    case TAG_NOT_OFFICIAL = 47015;

    #[ErrorMessage('slides_template.template_file_access_denied')]
    case TEMPLATE_FILE_ACCESS_DENIED = 47016;

    #[ErrorMessage('slides_template.project_template_manifest_not_found')]
    case PROJECT_TEMPLATE_MANIFEST_NOT_FOUND = 47017;

    #[ErrorMessage('slides_template.project_template_directory_invalid')]
    case PROJECT_TEMPLATE_DIRECTORY_INVALID = 47018;

    #[ErrorMessage('slides_template.project_template_asset_not_found')]
    case PROJECT_TEMPLATE_ASSET_NOT_FOUND = 47019;

    #[ErrorMessage('slides_template.project_template_manifest_invalid')]
    case PROJECT_TEMPLATE_MANIFEST_INVALID = 47020;

    #[ErrorMessage('slides_template.project_template_file_too_large')]
    case PROJECT_TEMPLATE_FILE_TOO_LARGE = 47021;

    #[ErrorMessage('slides_template.project_template_too_many_files')]
    case PROJECT_TEMPLATE_TOO_MANY_FILES = 47022;

    #[ErrorMessage('slides_template.project_template_too_many_preview_images')]
    case PROJECT_TEMPLATE_TOO_MANY_PREVIEW_IMAGES = 47023;

    #[ErrorMessage('slides_template.project_template_export_failed')]
    case PROJECT_TEMPLATE_EXPORT_FAILED = 47024;
}
