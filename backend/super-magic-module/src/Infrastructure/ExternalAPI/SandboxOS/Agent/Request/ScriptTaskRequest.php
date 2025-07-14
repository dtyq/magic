<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request;

use App\Infrastructure\Util\IdGenerator\IdGenerator;

/**
 * 中断请求类
 * 严格按照沙箱通信文档的中断请求格式.
 */
class ScriptTaskRequest
{
    public function __construct(
        private string $taskId = '',
        private array $arguments = [],
        private string $scriptName = '',
    ) {
    }

    /**
     * 创建中断请求
     */
    public static function create(string $taskId, array $arguments, string $scriptName): self
    {
        return new self($taskId, $arguments, $scriptName);
    }

    /**
     * 设置任务ID.
     */
    public function setTaskId(string $taskId): self
    {
        $this->taskId = $taskId;
        return $this;
    }

    /**
     * 获取任务ID.
     */
    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function setArguments(array $arguments): self
    {
        $this->arguments = $arguments;
        return $this;
    }

    public function getArguments(): array
    {
        return $this->arguments;
    }


    public function setScriptName(string $scriptName): self
    {
        $this->scriptName = $scriptName;
        return $this;
    }

    public function getScriptName(): string
    {
        return $this->scriptName;
    }


    /**
     * 转换为API请求数组
     * 根据沙箱通信文档的中断请求格式.
     */
    public function toArray(): array
    {
        $data = [
            'task_id' => $this->taskId,
            'arguments' => $this->arguments,
            'script_name' => $this->scriptName,
        ];

        return $data;
    }
}
