<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 错误码范围: 45000-45999.
 */
enum LongTermMemoryErrorCode: int
{
    #[ErrorMessage('long_term_memory.general_error')]
    case GENERAL_ERROR = 45001;

    #[ErrorMessage('long_term_memory.prompt_file_not_found')]
    case PROMPT_FILE_NOT_FOUND = 45002;

    #[ErrorMessage('long_term_memory.evaluation.llm_request_failed')]
    case EVALUATION_LLM_REQUEST_FAILED = 45003;

    #[ErrorMessage('long_term_memory.evaluation.llm_response_parse_failed')]
    case EVALUATION_LLM_RESPONSE_PARSE_FAILED = 45004;

    #[ErrorMessage('long_term_memory.evaluation.score_parse_failed')]
    case EVALUATION_SCORE_PARSE_FAILED = 45005;

    #[ErrorMessage('long_term_memory.not_found')]
    case MEMORY_NOT_FOUND = 45010;

    #[ErrorMessage('long_term_memory.creation_failed')]
    case CREATION_FAILED = 45011;

    #[ErrorMessage('long_term_memory.update_failed')]
    case UPDATE_FAILED = 45012;

    #[ErrorMessage('long_term_memory.deletion_failed')]
    case DELETION_FAILED = 45013;

    #[ErrorMessage('long_term_memory.enabled_memory_limit_exceeded')]
    case ENABLED_MEMORY_LIMIT_EXCEEDED = 45014;

    #[ErrorMessage('long_term_memory.project_not_found')]
    case PROJECT_NOT_FOUND = 45015;

    #[ErrorMessage('long_term_memory.project_access_denied')]
    case PROJECT_ACCESS_DENIED = 45016;
}
