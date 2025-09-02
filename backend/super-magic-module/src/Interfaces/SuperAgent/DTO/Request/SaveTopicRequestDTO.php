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
     * Topic mode.
     */
    public string $topicMode = '';

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

    public function setWorkspaceId(string $workspaceId): void
    {
        $this->workspaceId = $workspaceId;
    }

    /**
     * Get topic name.
     */
    public function getTopicName(): string
    {
        return $this->topicName;
    }

    public function setTopicName(string $topicName): void
    {
        $this->topicName = $topicName;
    }

    /**
     * Get project ID.
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function setProjectId(string $projectId): void
    {
        $this->projectId = $projectId;
    }

    /**
     * Get project mode.
     */
    public function getProjectMode(): string
    {
        return $this->projectMode;
    }

    public function setProjectMode(string $projectMode): void
    {
        $this->projectMode = $projectMode;
    }

    /**
     * Get topic mode.
     */
    public function getTopicMode(): string
    {
        return $this->topicMode;
    }

    public function setTopicMode(string $topicMode): void
    {
        $this->topicMode = $topicMode;
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
            'topic_name' => 'present|string|max:100',
            'project_id' => 'required|string',
            'project_mode' => 'nullable|string|in:general,ppt,data_analysis,report,meeting,summary,super-magic',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'topic_name.present' => 'Topic name field is required',
            'topic_name.max' => 'Topic name cannot exceed 100 characters',
            'project_id.required' => 'Project ID cannot be empty',
            'project_id.string' => 'Project ID must be a string',
            'project_mode.in' => 'Project mode must be one of: general, ppt, data_analysis, report, meeting, summary, super-magic',
        ];
    }
}
