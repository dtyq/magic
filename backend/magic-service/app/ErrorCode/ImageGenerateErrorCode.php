<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 43000 - 43999 图片生成相关错误码
 */
enum ImageGenerateErrorCode: int
{
    #[ErrorMessage(message: 'image_generate.general_error')]
    case GENERAL_ERROR = 44000;

    #[ErrorMessage(message: 'image_generate.response_format_error')]
    case RESPONSE_FORMAT_ERROR = 44001;

    #[ErrorMessage(message: 'image_generate.missing_image_data')]
    case MISSING_IMAGE_DATA = 44002;

    #[ErrorMessage(message: 'image_generate.no_valid_image_generated')]
    case NO_VALID_IMAGE = 44003;

    #[ErrorMessage(message: 'image_generate.input_image_audit_failed')]
    case INPUT_IMAGE_AUDIT_FAILED = 44004;

    #[ErrorMessage(message: 'image_generate.output_image_audit_failed')]
    case OUTPUT_IMAGE_AUDIT_FAILED = 44005;

    #[ErrorMessage(message: 'image_generate.input_text_audit_failed')]
    case INPUT_TEXT_AUDIT_FAILED = 44006;

    #[ErrorMessage(message: 'image_generate.output_text_audit_failed')]
    case OUTPUT_TEXT_AUDIT_FAILED = 44007;

    #[ErrorMessage(message: 'image_generate.text_blocked')]
    case TEXT_BLOCKED = 44008;

    #[ErrorMessage(message: 'image_generate.invalid_prompt')]
    case INVALID_PROMPT = 44009;

    #[ErrorMessage(message: 'image_generate.prompt_check_failed')]
    case PROMPT_CHECK_FAILED = 44010;

    #[ErrorMessage(message: 'image_generate.polling_failed')]
    case POLLING_FAILED = 44011;

    #[ErrorMessage(message: 'image_generate.task_timeout')]
    case TASK_TIMEOUT = 44012;

    #[ErrorMessage(message: 'image_generate.unsupported_image_format')]
    case UNSUPPORTED_IMAGE_FORMAT = 44013;

    #[ErrorMessage(message: 'image_generate.output_image_audit_failed_with_reason')]
    case OUTPUT_IMAGE_AUDIT_FAILED_WITH_REASON = 44014;

    #[ErrorMessage(message: 'image_generate.task_timeout_with_reason')]
    case TASK_TIMEOUT_WITH_REASON = 44015;

    #[ErrorMessage(message: 'image_generate.not_found_error_code')]
    case NOT_FOUND_ERROR_CODE = 44016;

    #[ErrorMessage(message: 'image_generate.invalid_aspect_ratio')]
    case INVALID_ASPECT_RATIO = 44017;

    #[ErrorMessage(message: 'image_generate.unsupported_image_size')]
    case UNSUPPORTED_IMAGE_SIZE = 44018;

    #[ErrorMessage(message: 'image_generate.unsupported_image_size_range')]
    case UNSUPPORTED_IMAGE_SIZE_RANGE = 44019;

    #[ErrorMessage(message: 'image_generate.model_not_support_edit')]
    case MODEL_NOT_SUPPORT_EDIT = 44020;
}
