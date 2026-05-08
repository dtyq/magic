<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Update project request DTO
 * Used to receive request parameters for updating project.
 */
class UpdateProjectRequestDTO extends AbstractRequestDTO
{
    /**
     * Project ID.
     */
    public string $id = '';

    /**
     * Workspace ID.
     */
    public ?string $workspaceId = null;

    /**
     * Project name.
     */
    public ?string $projectName = null;

    /**
     * Project description.
     */
    public ?string $projectDescription = null;

    public ?bool $isCollaborationEnabled = null;

    public ?string $defaultJoinPermission = null;

    /**
     * Project mode.
     * Null means no change. Valid values: general, ppt, data_analysis, report, meeting,
     * summary, super_magic, audio, agent_creator, skill_creator, custom_agent, custom_skill, magiclaw, chat.
     */
    public ?string $projectMode = null;

    /**
     * Target workspace ID for workspace change.
     * Null means no change.
     * Empty string "" means detach from workspace (workspace_id will be set to null).
     * Numeric string means move to that workspace.
     */
    public ?string $targetWorkspaceId = null;

    /**
     * Get project ID.
     */
    public function getId(): ?string
    {
        return $this->id;
    }

    /**
     * Get workspace ID.
     */
    public function getWorkspaceId(): ?int
    {
        if (is_null($this->workspaceId)) {
            return null;
        }
        return (int) $this->workspaceId;
    }

    /**
     * Get project name.
     */
    public function getProjectName(): ?string
    {
        return $this->projectName;
    }

    /**
     * Get project description.
     */
    public function getProjectDescription(): ?string
    {
        return $this->projectDescription;
    }

    public function getIsCollaborationEnabled(): ?bool
    {
        return $this->isCollaborationEnabled;
    }

    public function getDefaultJoinPermission(): ?string
    {
        return $this->defaultJoinPermission;
    }

    /**
     * Get project mode.
     */
    public function getProjectMode(): ?string
    {
        return $this->projectMode;
    }

    /**
     * Get target workspace ID for workspace change.
     * Returns null when not changing workspace.
     * Returns false-like null (via isDetachingWorkspace) when detaching.
     */
    public function getTargetWorkspaceId(): ?int
    {
        if (is_null($this->targetWorkspaceId)) {
            return null;
        }
        if ($this->targetWorkspaceId === '') {
            return null;
        }
        return (int) $this->targetWorkspaceId;
    }

    /**
     * Check whether the workspace change field was explicitly provided.
     */
    public function hasTargetWorkspaceId(): bool
    {
        return ! is_null($this->targetWorkspaceId);
    }

    /**
     * Check if the request is detaching the project from its workspace.
     */
    public function isDetachingWorkspace(): bool
    {
        return $this->targetWorkspaceId === '';
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'workspace_id' => 'nullable|integer',
            'project_name' => 'nullable|string|max:100',
            'default_join_permission' => 'nullable|string|max:100',
            'is_collaboration_enabled' => 'nullable|boolean',
            'project_description' => 'nullable|string|max:500',
            'project_mode' => 'nullable|string|max:50',
            'target_workspace_id' => 'nullable|string|max:64',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'workspace_id.integer' => 'Workspace ID must be an integer',
            'project_name.max' => 'Project name cannot exceed 100 characters',
            'project_description.max' => 'Project description cannot exceed 500 characters',
            'project_mode.max' => 'Project mode cannot exceed 50 characters',
            'target_workspace_id.max' => 'Target workspace ID cannot exceed 64 characters',
        ];
    }
}
