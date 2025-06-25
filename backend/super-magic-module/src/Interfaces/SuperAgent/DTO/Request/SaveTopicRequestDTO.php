<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Save topic request DTO
 * Used to receive request parameters for creating or updating topic.
 */
class SaveTopicRequestDTO extends AbstractRequestDTO
{
    /**
     * Topic ID, empty means create new topic.
     */
    public string $id = '';

    /**
     * Workspace ID.
     */
    public string $workspaceId = '';

    /**
     * Topic name.
     */
    public string $topicName = '';

    /**
     * Project ID.
     */
    public string $projectId = '';

    /**
     * Get topic ID (primary key).
     */
    public function getId(): string
    {
        return $this->id;
    }

    /**
     * Get workspace ID.
     */
    public function getWorkspaceId(): string
    {
        return $this->workspaceId;
    }

    /**
     * Get topic name.
     */
    public function getTopicName(): string
    {
        return $this->topicName;
    }

    /**
     * Get project ID.
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }

    /**
     * Check if this is an update operation.
     */
    public function isUpdate(): bool
    {
        return ! empty($this->id);
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'id' => 'nullable|string',
            'workspace_id' => 'required|string',
            'topic_name' => 'required|string|max:100',
            'project_id' => 'required|string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'workspace_id.required' => 'Workspace ID cannot be empty',
            'workspace_id.string' => 'Workspace ID must be a string',
            'topic_name.required' => 'Topic name cannot be empty',
            'topic_name.max' => 'Topic name cannot exceed 100 characters',
            'project_id.required' => 'Project ID cannot be empty',
            'project_id.string' => 'Project ID must be a string',
        ];
    }
}
