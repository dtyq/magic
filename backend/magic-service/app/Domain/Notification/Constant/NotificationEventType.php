<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Constant;

/** Public notification events only. */
enum NotificationEventType: string
{
    case TASK_FINISHED = 'task.finished';
    case TASK_ERROR = 'task.error';
    case PROJECT_RECIPIENTS_ADDED = 'share.project.recipients_added';
    case FILE_RECIPIENTS_ADDED = 'share.file.recipients_added';
    case PROJECT_WITHDRAWN = 'share.project.withdrawn';
    case FILE_WITHDRAWN = 'share.file.withdrawn';
    case SKILL_VERSION_APPROVED = 'review.skill.version_approved';
    case AGENT_VERSION_APPROVED = 'review.agent.version_approved';
}
