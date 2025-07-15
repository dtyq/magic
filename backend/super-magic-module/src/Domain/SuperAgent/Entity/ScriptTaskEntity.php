<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;

/**
 * 任务实体.
 */
class ScriptTaskEntity extends AbstractEntity
{
    protected string $taskId = '';

    protected array $arguments = [];

    protected string $scriptName = '';

    protected string $sandboxId = '';

    public function __construct(array $data = [])
    {
        // 默认设置
        parent::__construct($data);
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        $result = [
            'task_id' => $this->taskId,
            'arguments' => $this->arguments,
            'script_name' => $this->scriptName,
        ];

        // 移除空值
        return array_filter($result, function ($value) {
            return ! empty($value);
        });
    }

    /**
     * Create DTO from array.
     */
    public static function fromArray(array $data): self
    {
        return new self([
            'task_id' => $data['task_id'] ?? $data['taskId'] ?? '',
            'arguments' => $data['arguments'] ?? '',
            'script_name' => $data['script_name'] ?? $data['scriptName'] ?? '',
        ]);
    }

    public function getScriptName(): string
    {
        return $this->scriptName;
    }

    public function setScriptName(string $scriptName): self
    {
        $this->scriptName = $scriptName;
        return $this;
    }

    public function getArguments(): array
    {
        return $this->arguments;
    }

    public function setArguments(array $arguments): self
    {
        $this->arguments = $arguments;
        return $this;
    }

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function setTaskId(string $taskId): self
    {
        $this->taskId = $taskId;
        return $this;
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function setSandboxId(string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;
        return $this;
    }
}
