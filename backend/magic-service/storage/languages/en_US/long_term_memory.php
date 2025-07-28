<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'general_error' => 'Long-term memory operation failed',
    'prompt_file_not_found' => 'Prompt file not found: :path',
    'not_found' => 'Memory not found',
    'creation_failed' => 'Failed to create memory',
    'update_failed' => 'Failed to update memory',
    'deletion_failed' => 'Failed to delete memory',
    'evaluation' => [
        'llm_request_failed' => 'Memory evaluation request failed',
        'llm_response_parse_failed' => 'Failed to parse memory evaluation response',
        'score_parse_failed' => 'Failed to parse memory evaluation score',
    ],
    'entity' => [
        'content_too_long' => 'Memory content length cannot exceed 65535 characters',
        'pending_content_too_long' => 'Pending memory content length cannot exceed 65535 characters',
        'enabled_status_restriction' => 'Only active memories can be enabled or disabled',
        'user_memory_limit_exceeded' => 'User memory limit reached (20 memories)',
    ],
    'api' => [
        'validation_failed' => 'Validation failed: :errors',
        'memory_not_belong_to_user' => 'Memory not found or no access permission',
        'partial_memory_not_belong_to_user' => 'Some memories not found or no access permission',
        'accept_memories_failed' => 'Failed to accept memory suggestions: :error',
    ],
];
