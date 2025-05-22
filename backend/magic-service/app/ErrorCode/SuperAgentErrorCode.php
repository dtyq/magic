<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 错误码范围:51000-51200.
 */
enum SuperAgentErrorCode: int
{
    #[ErrorMessage('workspace.parameter_check_failure')]
    case VALIDATE_FAILED = 51000;

    #[ErrorMessage('topic.topic_not_found')]
    case TOPIC_NOT_FOUND = 51100;

    #[ErrorMessage('task.task_not_found')]
    case TASK_NOT_FOUND = 51200;

    #[ErrorMessage('task.work_dir.not_found')]
    case WORK_DIR_NOT_FOUND = 51201;
}
