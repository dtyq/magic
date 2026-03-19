<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Constants;

/**
 * 沙箱 API 端点常量
 * 统一管理沙箱服务的 API 路径.
 */
class SandboxEndpoints
{
    /**
     * ASR 任务启动端点.
     */
    public const ASR_TASK_START = 'api/asr/task/start';

    /**
     * ASR 任务完成端点.
     */
    public const ASR_TASK_FINISH = 'api/asr/task/finish';

    /**
     * ASR 任务取消端点.
     */
    public const ASR_TASK_CANCEL = 'api/asr/task/cancel';

    /**
     * Agent 消息聊天端点.
     */
    public const AGENT_MESSAGES_CHAT = 'api/v1/messages/chat';

    /**
     * 工作区状态查询端点.
     */
    public const WORKSPACE_STATUS = 'api/v1/workspace/status';

    /**
     * Workspace export endpoint.
     */
    public const WORKSPACE_EXPORT = 'api/v1/workspace/export';
}
