<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 错误码范围:51000-51300.
 */
enum SuperAgentErrorCode: int
{
    #[ErrorMessage('workspace.parameter_check_failure')]
    case VALIDATE_FAILED = 51000;

    #[ErrorMessage('workspace.access_denied')]
    case WORKSPACE_ACCESS_DENIED = 51001;

    #[ErrorMessage('topic.topic_not_found')]
    case TOPIC_NOT_FOUND = 51100;

    #[ErrorMessage('topic.create_topic_failed')]
    case CREATE_TOPIC_FAILED = 51101;

    #[ErrorMessage('task.not_found')]
    case TASK_NOT_FOUND = 51200;

    #[ErrorMessage('task.work_dir_not_found')]
    case WORK_DIR_NOT_FOUND = 51201;

    #[ErrorMessage('task.create_workspace_version_failed')]
    case CREATE_WORKSPACE_VERSION_FAILED = 51202;

    #[ErrorMessage('topic.concurrent_operation_failed')]
    case TOPIC_LOCK_FAILED = 51203;
}
