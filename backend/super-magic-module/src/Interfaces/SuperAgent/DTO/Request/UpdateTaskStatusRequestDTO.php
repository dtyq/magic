<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

class UpdateTaskStatusRequestDTO extends FormRequest
{
    /**
     * @var string 任务ID
     */
    protected string $taskId = '';

    /**
     * @var string 任务状态
     */
    protected string $status = '';

    /**
     * 验证规则.
     */
    public function rules(): array
    {
        return [
            'task_id' => 'required|string',
            'status' => 'required|string|in:waiting,running,finished,error',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'task_id' => '任务ID',
            'status' => '任务状态',
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

    public function setTaskId(string $taskId): self
    {
        $this->taskId = $taskId;
        return $this;
    }

    public function setStatus(string $status): self
    {
        $this->status = $status;
        return $this;
    }

    /**
     * 准备数据.
     */
    protected function prepareForValidation(): void
    {
        $this->taskId = (string) $this->input('task_id', '');
        $this->status = (string) $this->input('status', '');
    }
}
