<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'not_found' => 'Task not found',
    'work_dir_not_found' => 'Work directory not found',
    'continue' => 'Continue',
    'initialize_error' => 'The system is currently busy, please try again later.',
    'agent_stopped' => 'Task has been terminated',
    'finished_task_action' => 'Output of completed result file',
    'disable_web_search_constraint' => <<<'TEXT'
【Important Constraint】For this round of user message, please strictly follow the following requirements:

1. Do not use the web_search tool for internet searches

2. Only use the following tools to retrieve information:
   - list_dir: View workspace directory structure
   - file_search: Search file names
   - grep_search: Search file content
   - read_files: Read file content

3. If relevant information cannot be found locally, directly inform the user: "No relevant information found in the workspace"

4. Answer questions based on existing files in the workspace and previous conversation content

Important: This constraint only applies to this round of user message. If there is no explicit constraint disabling the web_search tool in the next round of user message, proceed normally and you can directly use the web_search tool for internet searches without additional confirmation.
TEXT,
];
