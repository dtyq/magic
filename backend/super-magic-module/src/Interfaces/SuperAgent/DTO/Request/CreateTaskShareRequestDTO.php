<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Create task share request DTO.
 * Simplified DTO for creating share of a completed task's topic.
 */
class CreateTaskShareRequestDTO extends AbstractRequestDTO
{
    /**
     * Task ID.
     */
    public string $taskId = '';

    /**
     * Extra configuration.
     */
    public array $extra = [];

    /**
     * Get task ID.
     */
    public function getTaskId(): string
    {
        return $this->taskId;
    }

    /**
     * Get extra configuration.
     */
    public function getExtra(): array
    {
        return $this->extra;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'task_id' => 'required|string',
            'extra' => 'nullable|array',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'task_id.required' => 'Task ID is required',
            'task_id.string' => 'Task ID must be a string',
        ];
    }
}
