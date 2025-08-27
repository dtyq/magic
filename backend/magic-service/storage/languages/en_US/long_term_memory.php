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
    'enabled_memory_limit_exceeded' => 'Enabled memory limit exceeded',
    'memory_category_limit_exceeded' => 'Maximum :limit :category can be enabled',
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
        'memory_created_successfully' => 'Memory created successfully',
        'memory_updated_successfully' => 'Memory updated successfully',
        'memory_deleted_successfully' => 'Memory deleted successfully',
        'memory_reinforced_successfully' => 'Memory reinforced successfully',
        'memories_batch_reinforced_successfully' => 'Memories batch reinforced successfully',
        'memories_accepted_successfully' => 'Successfully accepted :count memory suggestions',
        'memories_rejected_successfully' => 'Successfully rejected and deleted :count memory suggestions',
        'batch_process_memories_failed' => 'Failed to batch process memory suggestions',
        'batch_action_memories_failed' => 'Batch :action memory suggestions failed: :error',
        'user_manual_edit_explanation' => 'User manually modified memory content',
        'content_auto_compressed_explanation' => 'Content too long, automatically compressed',
        'parameter_validation_failed' => 'Parameter validation failed: :errors',
        'action_accept' => 'accept',
        'action_reject' => 'reject',
    ],
];
