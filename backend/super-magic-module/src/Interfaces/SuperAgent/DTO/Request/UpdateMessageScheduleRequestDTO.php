<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Update message schedule request DTO.
 * Used to receive request parameters for updating message schedule.
 */
class UpdateMessageScheduleRequestDTO extends AbstractRequestDTO
{
    /**
     * Task name.
     */
    public string $taskName = '';

    /**
     * Message type.
     */
    public string $messageType = '';

    /**
     * Message content.
     */
    public array $messageContent = [];

    /**
     * Status (0-disabled, 1-enabled).
     */
    public int $status = 0;

    /**
     * Time configuration.
     */
    public array $timeConfig = [];

    /**
     * Get task name.
     */
    public function getTaskName(): string
    {
        return $this->taskName;
    }

    /**
     * Get message type.
     */
    public function getMessageType(): string
    {
        return $this->messageType;
    }

    /**
     * Get message content.
     */
    public function getMessageContent(): array
    {
        return $this->messageContent;
    }

    /**
     * Get status.
     */
    public function getStatus(): int
    {
        return $this->status;
    }

    /**
     * Get time configuration.
     */
    public function getTimeConfig(): array
    {
        return $this->timeConfig;
    }

    /**
     * Create TimeConfigDTO from time configuration.
     */
    public function createTimeConfigDTO(): TimeConfigDTO
    {
        $timeConfigDTO = new TimeConfigDTO();
        $timeConfigDTO->type = $this->timeConfig['type'] ?? '';
        $timeConfigDTO->day = $this->timeConfig['day'] ?? '';
        $timeConfigDTO->time = $this->timeConfig['time'] ?? '';
        $timeConfigDTO->value = $this->timeConfig['value'] ?? [];
        
        return $timeConfigDTO;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'task_name' => 'nullable|string|max:255',
            'message_type' => 'nullable|string|max:64',
            'message_content' => 'nullable|array',
            'status' => 'nullable|integer|in:0,1',
            'time_config' => 'nullable|array',
            'time_config.type' => [
                'required_with:time_config',
                'string',
                'in:no_repeat,daily_repeat,weekly_repeat,monthly_repeat,annually_repeat,weekday_repeat,custom_repeat'
            ],
            'time_config.day' => 'nullable|string',
            'time_config.time' => ['nullable', 'string', 'regex:/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/'],
            'time_config.value' => 'nullable|array',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'task_name.string' => 'Task name must be a string',
            'task_name.max' => 'Task name cannot exceed 255 characters',
            'message_type.string' => 'Message type must be a string',
            'message_type.max' => 'Message type cannot exceed 64 characters',
            'message_content.array' => 'Message content must be an array',
            'status.integer' => 'Status must be an integer',
            'status.in' => 'Status must be 0 or 1',
            'time_config.array' => 'Time configuration must be an array',
            'time_config.type.required_with' => 'Time configuration type is required when time configuration is provided',
            'time_config.type.string' => 'Time configuration type must be a string',
            'time_config.type.in' => 'Time configuration type must be one of: no_repeat, daily_repeat, weekly_repeat, monthly_repeat, annually_repeat, weekday_repeat, custom_repeat',
            'time_config.day.string' => 'Time configuration day must be a string',
            'time_config.time.string' => 'Time configuration time must be a string',
            'time_config.time.regex' => 'Time configuration time must be in HH:MM format',
            'time_config.value.array' => 'Time configuration value must be an array',
        ];
    }
}
