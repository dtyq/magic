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
<constraint>
【Temporary Constraint - Only Valid for This Message】

Constraints for this message:
1. Do not use the web_search tool
2. Only use list_dir, file_search, grep_search, read_files to retrieve information
3. If information cannot be found, inform the user: "No relevant information found in the workspace"

Constraint Expiration Rules:
- The constraint expires immediately after you finish replying
- In the next message, if the user does not mention the same constraint again, the constraint is lifted
- After the constraint is lifted, resume normal behavior and directly use all tools (including web_search), do not say "environment restrictions" or mention previous constraints
</constraint>
TEXT,
];
