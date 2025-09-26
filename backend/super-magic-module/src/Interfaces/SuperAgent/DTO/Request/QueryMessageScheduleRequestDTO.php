<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Query message schedule request DTO.
 * Used to receive request parameters for querying message schedules.
 */
class QueryMessageScheduleRequestDTO extends AbstractRequestDTO
{
    /**
     * Page number.
     */
    public int $page = 1;

    /**
     * Page size.
     */
    public int $pageSize = 10;

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
     * Task name for fuzzy search.
     */
    public string $taskName = '';

    /**
     * Completed filter.
     */
    public ?int $completed = null;

    /**
     * Enabled filter.
     */
    public ?int $enabled = null;

    /**
     * Order by field.
     */
    public string $orderBy = 'updated_at';

    /**
     * Order direction.
     */
    public string $orderDirection = 'desc';

    /**
     * Get page number.
     */
    public function getPage(): int
    {
        return $this->page;
    }

    /**
     * Get page size.
     */
    public function getPageSize(): int
    {
        return $this->pageSize;
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
     * Get task name.
     */
    public function getTaskName(): string
    {
        return $this->taskName;
    }

    /**
     * Get completed.
     */
    public function getCompleted(): ?int
    {
        return $this->completed;
    }

    /**
     * Get enabled.
     */
    public function getEnabled(): ?int
    {
        return $this->enabled;
    }

    /**
     * Get order by field.
     */
    public function getOrderBy(): string
    {
        return $this->orderBy;
    }

    /**
     * Get order direction.
     */
    public function getOrderDirection(): string
    {
        return $this->orderDirection;
    }

    /**
     * Build query conditions array.
     */
    public function buildConditions(string $userId, string $organizationCode): array
    {
        $conditions = [
            'user_id' => $userId,
            'organization_code' => $organizationCode,
        ];

        if (! empty($this->workspaceId)) {
            $conditions['workspace_id'] = (int) $this->workspaceId;
        }

        if (! empty($this->projectId)) {
            $conditions['project_id'] = (int) $this->projectId;
        }

        if (! empty($this->topicId)) {
            $conditions['topic_id'] = (int) $this->topicId;
        }

        if (! empty($this->taskName)) {
            $conditions['task_name_like'] = $this->taskName;
        }

        if ($this->completed !== null) {
            $conditions['completed'] = $this->completed;
        }

        if ($this->enabled !== null) {
            $conditions['enabled'] = $this->enabled;
        }

        return $conditions;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'workspace_id' => 'nullable|string',
            'project_id' => 'nullable|string',
            'topic_id' => 'nullable|string',
            'task_name' => 'nullable|string|max:255',
            'completed' => 'nullable|integer|in:0,1',
            'enabled' => 'nullable|integer|in:0,1',
            'order_by' => 'nullable|string|in:id,task_name,completed,enabled,created_at,updated_at',
            'order_direction' => 'nullable|string|in:asc,desc',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'page.integer' => 'Page must be an integer',
            'page.min' => 'Page must be at least 1',
            'page_size.integer' => 'Page size must be an integer',
            'page_size.min' => 'Page size must be at least 1',
            'page_size.max' => 'Page size cannot exceed 100',
            'workspace_id.string' => 'Workspace ID must be a string',
            'project_id.string' => 'Project ID must be a string',
            'topic_id.string' => 'Topic ID must be a string',
            'task_name.string' => 'Task name must be a string',
            'task_name.max' => 'Task name cannot exceed 255 characters',
            'completed.integer' => 'Completed must be an integer',
            'completed.in' => 'Completed must be 0 or 1',
            'enabled.integer' => 'Enabled must be an integer',
            'enabled.in' => 'Enabled must be 0 or 1',
            'order_by.string' => 'Order by must be a string',
            'order_by.in' => 'Order by must be one of: id, task_name, completed, enabled, created_at, updated_at',
            'order_direction.string' => 'Order direction must be a string',
            'order_direction.in' => 'Order direction must be asc or desc',
        ];
    }
}
