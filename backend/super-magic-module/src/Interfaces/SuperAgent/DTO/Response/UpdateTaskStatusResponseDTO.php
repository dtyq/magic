<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

class UpdateTaskStatusResponseDTO
{
    /**
     * @var string 任务ID
     */
    protected string $taskId;

    /**
     * @var string 任务状态
     */
    protected string $status;

    /**
     * 构造函数.
     */
    public function __construct(int $taskId, string $status)
    {
        $this->taskId = (string) $taskId;
        $this->status = $status;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'task_id' => $this->taskId,
            'status' => $this->status,
        ];
    }

    /**
     * 获取任务ID.
     */
    public function getTaskId(): string
    {
        return $this->taskId;
    }

    /**
     * 获取任务状态
     */
    public function getStatus(): string
    {
        return $this->status;
    }
}
