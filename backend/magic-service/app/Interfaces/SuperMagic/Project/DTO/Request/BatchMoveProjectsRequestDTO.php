<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Project\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Batch move projects request DTO.
 *
 * Used to receive request parameters for batch moving projects to target workspace.
 *
 * Special handling:
 * - target_workspace_id = "" (empty string) means move to no workspace (workspace_id will be null)
 */
class BatchMoveProjectsRequestDTO extends AbstractRequestDTO
{
    /**
     * Project IDs to move.
     */
    public array $projectIds = [];

    /**
     * Target workspace ID.
     * Empty string means move to no workspace.
     */
    public string $targetWorkspaceId = '';

    public ?string $preProjectId = null;

    public ?string $nextProjectId = null;

    public bool $preProjectIdProvided = false;

    public bool $nextProjectIdProvided = false;

    /**
     * Get project IDs.
     */
    public function getProjectIds(): array
    {
        return $this->projectIds;
    }

    /**
     * Get target workspace ID.
     * Returns null when moving to no workspace (empty string).
     *
     * @return null|int Workspace ID or null for no workspace
     */
    public function getTargetWorkspaceId(): ?int
    {
        // Empty string means "move to no workspace"
        if ($this->targetWorkspaceId === '') {
            return null;
        }

        return (int) $this->targetWorkspaceId;
    }

    /**
     * Check if moving to no workspace.
     *
     * @return bool True if target is no workspace
     */
    public function isMovingToNoWorkspace(): bool
    {
        return $this->targetWorkspaceId === '';
    }

    public function getPreProjectId(): ?int
    {
        if ($this->preProjectId === null || $this->preProjectId === '') {
            return null;
        }

        return (int) $this->preProjectId;
    }

    public function getNextProjectId(): ?int
    {
        if ($this->nextProjectId === null || $this->nextProjectId === '') {
            return null;
        }

        return (int) $this->nextProjectId;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_ids' => 'required|array|min:1|max:20',
            'project_ids.*' => 'required|string',
            'target_workspace_id' => 'present|string|max:64',
            'pre_project_id' => 'nullable|string',
            'next_project_id' => 'nullable|string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_ids.required' => 'Project IDs cannot be empty',
            'project_ids.array' => 'Project IDs must be an array',
            'project_ids.min' => 'At least one project must be selected',
            'project_ids.max' => 'Cannot move more than 20 projects at once',
            'project_ids.*.required' => 'Each project ID cannot be empty',
            'project_ids.*.string' => 'Each project ID must be a string',
            'target_workspace_id.present' => 'Target workspace ID field is required',
            'target_workspace_id.string' => 'Target workspace ID must be a string',
            'target_workspace_id.max' => 'Target workspace ID cannot exceed 64 characters',
        ];
    }
}
