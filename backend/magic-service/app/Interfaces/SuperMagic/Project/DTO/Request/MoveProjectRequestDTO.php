<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Project\DTO\Request;

use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Move project request DTO
 * Used to receive request parameters for moving project to another workspace.
 *
 * Special handling:
 * - target_workspace_id = "" (empty string) means move to no workspace (workspace_id will be null)
 */
class MoveProjectRequestDTO extends AbstractRequestDTO
{
    /**
     * Source project ID.
     */
    public string $sourceProjectId = '';

    /**
     * Target workspace ID.
     * Empty string means move to no workspace.
     */
    public string $targetWorkspaceId = '';

    /**
     * Target project name.
     * Null means keep the current project name.
     */
    public ?string $targetProjectName = null;

    /**
     * Project mode.
     * Null means keep the current project mode.
     */
    public ?string $projectMode = null;

    public ?string $preProjectId = null;

    public ?string $nextProjectId = null;

    public bool $preProjectIdProvided = false;

    public bool $nextProjectIdProvided = false;

    /**
     * Get source project ID.
     */
    public function getSourceProjectId(): int
    {
        return (int) $this->sourceProjectId;
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

    /**
     * Get target project name.
     */
    public function getTargetProjectName(): ?string
    {
        if ($this->targetProjectName === '') {
            return null;
        }

        return $this->targetProjectName;
    }

    /**
     * Get project mode.
     */
    public function getProjectMode(): ?string
    {
        if ($this->projectMode === '' || $this->projectMode === null) {
            return null;
        }

        return $this->projectMode;
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
        $projectModes = implode(',', ProjectMode::getAllModes());

        return [
            'source_project_id' => 'required|numeric',
            'target_workspace_id' => 'present|string|max:64',
            'target_project_name' => 'nullable|string|max:100',
            'project_mode' => 'nullable|string|in:' . $projectModes,
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
            'source_project_id.required' => 'Source project ID cannot be empty',
            'source_project_id.numeric' => 'Source project ID must be a valid number',
            'target_workspace_id.present' => 'Target workspace ID field is required',
            'target_workspace_id.string' => 'Target workspace ID must be a string',
            'target_workspace_id.max' => 'Target workspace ID cannot exceed 64 characters',
            'target_project_name.string' => 'Target project name must be a string',
            'target_project_name.max' => 'Target project name cannot exceed 100 characters',
        ];
    }
}
