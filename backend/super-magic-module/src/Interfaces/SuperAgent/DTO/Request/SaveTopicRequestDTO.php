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
     * Project mode.
     */
    public string $projectMode = '';

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
     * Get project mode.
     */
    public function getProjectMode(): string
    {
        return $this->projectMode;
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
            'topic_name' => 'present|string|max:100',
            'project_id' => 'required|string',
            'project_mode' => 'nullable|string|in:general,ppt,data_analysis,report,meeting,super-magic',
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
            'topic_name.present' => 'Topic name field is required',
            'topic_name.max' => 'Topic name cannot exceed 100 characters',
            'project_id.required' => 'Project ID cannot be empty',
            'project_id.string' => 'Project ID must be a string',
            'project_mode.in' => 'Project mode must be one of: general, ppt, data_analysis, report, meeting, super-magic',
        ];
    }
}
