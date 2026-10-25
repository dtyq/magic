<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'open_api' => [
        'invalid_text_content' => 'Text mode requires non-empty content and no rich_content',
        'content_conflict' => 'Rich text mode requires rich_content without content or file_ids',
        'configuration_conflict' => 'Rich text configuration belongs in rich_content.extra.super_agent',
        'invalid_content_type' => 'content_type must be text or rich_text',
        'invalid_file_ids' => 'file_ids must be a list of valid file IDs',
        'invalid_rich_content' => 'Rich text content must be a valid Tiptap doc JSON string',
        'invalid_file_reference' => 'Referenced file is unavailable, unauthorized, or of the wrong type',
        'create_messages_only' => 'Task creation accepts normal and follow_up messages, not interrupts or tool replies',
        'invalid_tool_reply' => 'Invalid tool reply format',
    ],
    'invalid' => 'Invalid parameter',
    'not_found' => 'Task not found',
    'already_exists' => 'Same name and type task already exists',
    'create_failed' => 'Task create failed',
    'update_failed' => 'Task update failed',
    'delete_failed' => 'Task delete failed',
    'list_failed' => 'Task list failed',
    'get_failed' => 'Task get failed',
    'task_not_found' => 'Task not found',
    'access_denied' => 'You do not have permission to access this task',
    'agent_id_required' => 'Agent ID is required',
    'topic_id_required' => 'Topic ID is required',
    'work_dir_not_found' => 'Work directory not found',
    'continue' => 'Continue',
    'initialize_error' => 'The system is currently busy, please try again later.',
    'agent_stopped' => 'Task has been terminated',
    'finished_task_action' => 'Output of completed result file',
    'id_required' => 'Value is required',

    'access_token' => [
        'not_found' => 'Resource not found',
    ],
    'create_workspace_version_failed' => 'Operation failed',
];
