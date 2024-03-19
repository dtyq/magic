<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Create message schedule request DTO.
 * Used to receive request parameters for creating message schedule.
 */
class CreateMessageScheduleRequestDTO extends AbstractRequestDTO
{
    /**
     * Task name.
     */
    public string $taskName = '';

    /**
     * Workspace ID.
     */
    public string $workspaceId = '';

    /**
     * Project ID.
     */
    public string $projectId = '';

    /**
     * Topic ID.
     */
    public string $topicId = '';

    /**
     * Message type.
     */
    public string $messageType = '';

    /**
     * Message content.
     */
    public array $messageContent = [];

    /**
     * Enabled status (0-disabled, 1-enabled).
     */
    public int $enabled = 1;

    /**
     * Deadline time.
     */
    public ?string $deadline = null;

    /**
     * Time configuration.
     */
    public array $timeConfig = [];

    /**
     * MCP plugins configuration.
     */
    public ?array $plugins = null;

    /**
     * Get task name.
     */
    public function getTaskName(): string
    {
        return $this->taskName;
    }

    /**
     * Get workspace ID.
     */
    public function getWorkspaceId(): string
    {
        return $this->workspaceId;
    }

    /**
     * Get project ID.
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }

    /**
     * Get topic ID.
     */
    public function getTopicId(): string
    {
        return $this->topicId;
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
     * Get completed status (always returns default value 0).
     */
    public function getCompleted(): int
    {
        return 0; // Always return default value - not completed
    }

    /**
     * Get enabled status.
     */
    public function getEnabled(): int
    {
        return $this->enabled;
    }

    /**
     * Get deadline.
     */
    public function getDeadline(): ?string
    {
        // Convert empty string to null for database compatibility
        return $this->deadline === '' ? null : $this->deadline;
    }

    /**
     * Get remark (always returns empty string).
     */
    public function getRemark(): string
    {
        return ''; // Always return empty string - no client modification allowed
    }

    /**
     * Get time configuration.
     */
    public function getTimeConfig(): array
    {
        return $this->timeConfig;
    }

    /**
     * Get plugins configuration.
     */
    public function getPlugins(): ?array
    {
        return $this->plugins;
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
            'task_name' => 'required|string|max:255',
            'workspace_id' => 'required|string',
            'project_id' => 'nullable|string',
            'topic_id' => 'nullable|string',
            'message_type' => 'required|string|max:64',
            'message_content' => 'required|array',
            'enabled' => 'nullable|integer|in:0,1',
            'deadline' => 'nullable|date_format:Y-m-d H:i:s',
            'time_config' => 'required|array',
            'time_config.type' => [
                'required',
                'string',
                'in:no_repeat,daily_repeat,weekly_repeat,monthly_repeat,annually_repeat,weekday_repeat,custom_repeat',
            ],
            'time_config.day' => 'nullable|string',
            'time_config.time' => ['nullable', 'string', 'regex:/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/'],
            'time_config.value' => 'nullable|array',
            'plugins' => 'nullable|array',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'task_name.required' => 'Task name cannot be empty',
            'task_name.string' => 'Task name must be a string',
            'task_name.max' => 'Task name cannot exceed 255 characters',
            'workspace_id.required' => 'Workspace ID cannot be empty',
            'workspace_id.string' => 'Workspace ID must be a string',
            'project_id.string' => 'Project ID must be a string',
            'topic_id.string' => 'Topic ID must be a string',
            'message_type.required' => 'Message type cannot be empty',
            'message_type.string' => 'Message type must be a string',
            'message_type.max' => 'Message type cannot exceed 64 characters',
            'message_content.required' => 'Message content cannot be empty',
            'message_content.array' => 'Message content must be an array',
            'enabled.integer' => 'Enabled must be an integer',
            'enabled.in' => 'Enabled must be 0 or 1',
            'deadline.date_format' => 'Deadline must be in Y-m-d H:i:s format',
            'time_config.required' => 'Time configuration cannot be empty',
            'time_config.array' => 'Time configuration must be an array',
            'time_config.type.required' => 'Time configuration type cannot be empty',
            'time_config.type.string' => 'Time configuration type must be a string',
            'time_config.type.in' => 'Time configuration type must be one of: no_repeat, daily_repeat, weekly_repeat, monthly_repeat, annually_repeat, weekday_repeat, custom_repeat',
            'time_config.day.string' => 'Time configuration day must be a string',
            'time_config.time.string' => 'Time configuration time must be a string',
            'time_config.time.regex' => 'Time configuration time must be in HH:MM format',
            'time_config.value.array' => 'Time configuration value must be an array',
            'plugins.array' => 'Plugins must be an array',
        ];
    }
}
