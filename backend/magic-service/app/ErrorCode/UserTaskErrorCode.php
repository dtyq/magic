<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 范围:8000, 8999.
 */
enum UserTaskErrorCode: int
{
    // 参数不合法 不合法
    #[ErrorMessage('task.invalid')]
    case PARAMETER_INVALID = 8001;

    // 任务不存在
    #[ErrorMessage('task.not_found')]
    case TASK_NOT_FOUND = 8002;

    // 任务已存在
    #[ErrorMessage('task.already_exists')]
    case TASK_ALREADY_EXISTS = 8003;

    // 任务创建失败
    #[ErrorMessage('task.create_failed')]
    case TASK_CREATE_FAILED = 8004;

    // 任务更新失败
    #[ErrorMessage('task.update_failed')]
    case TASK_UPDATE_FAILED = 8005;

    // 任务删除失败
    #[ErrorMessage('task.delete_failed')]
    case TASK_DELETE_FAILED = 8006;

    // 任务列表获取失败
    #[ErrorMessage('task.list_failed')]
    case TASK_LIST_FAILED = 8007;

    // 任务获取失败
    #[ErrorMessage('task.get_failed')]
    case TASK_GET_FAILED = 8008;

    // agentId 不能为空
    #[ErrorMessage('task.agent_id_required')]
    case AGENT_ID_REQUIRED = 8009;

    // topicId 不能为空
    #[ErrorMessage('task.topic_id_required')]
    case TOPIC_ID_REQUIRED = 8010;
}
