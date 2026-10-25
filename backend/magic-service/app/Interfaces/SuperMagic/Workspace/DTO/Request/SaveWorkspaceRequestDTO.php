<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Workspace\DTO\Request;

use App\Domain\SuperMagic\Workspace\Entity\ValueObject\WorkspaceType;
use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Save workspace request DTO
 * Used to receive request parameters for creating or updating workspace.
 */
class SaveWorkspaceRequestDTO extends AbstractRequestDTO
{
    /**
     * Workspace ID, empty means create new workspace.
     */
    public string $id = '';

    /**
     * Workspace name.
     */
    public string $workspaceName = '';

    /**
     * Workspace type: default, finance, audio.
     * Only used when creating workspace, ignored when updating.
     */
    public string $workspaceType = '';

    /**
     * Whether pinned. Null means not changed.
     */
    public ?bool $isPinned = null;

    /**
     * Previous workspace ID for manual ordering. Null moves to the first
     * position of the manual-ordering segment.
     */
    public ?string $preWorkspaceId = null;

    public ?string $nextWorkspaceId = null;

    public bool $preWorkspaceIdProvided = false;

    public bool $nextWorkspaceIdProvided = false;

    /**
     * Get workspace ID (if exists).
     */
    public function getWorkspaceId(): ?string
    {
        return $this->id ?: null;
    }

    /**
     * Get workspace name.
     */
    public function getWorkspaceName(): string
    {
        return $this->workspaceName;
    }

    /**
     * Get workspace type.
     */
    public function getWorkspaceType(): string
    {
        return $this->workspaceType;
    }

    public function getIsPinned(): ?bool
    {
        return $this->isPinned;
    }

    public function getPreWorkspaceId(): ?int
    {
        if ($this->preWorkspaceId === null || $this->preWorkspaceId === '') {
            return null;
        }

        return (int) $this->preWorkspaceId;
    }

    public function getNextWorkspaceId(): ?int
    {
        if ($this->nextWorkspaceId === null || $this->nextWorkspaceId === '') {
            return null;
        }

        return (int) $this->nextWorkspaceId;
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
        $validTypes = implode(',', WorkspaceType::getAllTypes());

        return [
            'id' => 'nullable|string',
            'workspace_name' => 'required_without:id|string|max:50',
            'workspace_type' => 'nullable|string|in:' . $validTypes,
            'is_pinned' => 'nullable|boolean',
            'pre_workspace_id' => 'nullable|string',
            'next_workspace_id' => 'nullable|string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        $validTypesString = implode(', ', WorkspaceType::getAllTypes());

        return [
            'workspace_name.required' => 'Workspace name cannot be empty',
            'workspace_name.required_without' => 'Workspace name cannot be empty',
            'workspace_name.string' => 'Workspace name must be a string',
            'workspace_name.max' => 'Workspace name cannot exceed 50 characters',
            'workspace_type.in' => 'Workspace type must be one of: ' . $validTypesString,
            'is_pinned.boolean' => 'Pinned status must be a boolean',
        ];
    }
}
