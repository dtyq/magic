<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 检查话题复制状态请求DTO.
 */
class DuplicateTopicCheckRequestDTO extends AbstractRequestDTO
{
    /**
     * 任务键.
     */
    public string $taskKey = '';

    /**
     * 获取任务键.
     */
    public function getTaskKey(): string
    {
        return $this->taskKey;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'task_key' => 'required|string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'task_key.required' => 'Task key is required',
            'task_key.string' => 'Task key must be a string',
        ];
    }
}
