<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Constant;

/** Public notification types only. */
enum NotificationType: string
{
    case TASK_FINISHED = 'task_finished';
    case TASK_FAILED = 'task_failed';
    case PROJECT_SHARED = 'project_shared';
    case FILE_SHARED = 'file_shared';
    case SKILL_APPROVED = 'skill_approved';
    case AGENT_APPROVED = 'agent_approved';
}
