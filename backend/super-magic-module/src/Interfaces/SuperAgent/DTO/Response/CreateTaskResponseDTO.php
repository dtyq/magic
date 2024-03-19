<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;

class CreateTaskResponseDTO
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
     * @var string 创建时间
     */
    protected string $createdAt;

    /**
     * 构造函数.
     */
    public function __construct(int $taskId, string $status, string $createdAt)
    {
        $this->taskId = (string) $taskId;
        $this->status = $status;
        $this->createdAt = $createdAt;
    }

    /**
     * 从任务实体创建响应DTO.
     */
    public static function fromEntity(TaskEntity $entity): self
    {
        return new self(
            $entity->getId(),
            $entity->getStatus()->value,
            $entity->getCreatedAt()
        );
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'task_id' => $this->taskId,
            'status' => $this->status,
            'created_at' => $this->createdAt,
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

    /**
     * 获取创建时间.
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
}
