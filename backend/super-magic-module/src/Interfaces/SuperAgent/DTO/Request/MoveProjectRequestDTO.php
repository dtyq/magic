<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

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
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'source_project_id' => 'required|numeric',
            'target_workspace_id' => 'present|string|max:64',
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
        ];
    }
}
