<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceType;

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
            'workspace_name' => 'required|string|max:50',
            'workspace_type' => 'nullable|string|in:' . $validTypes,
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
            'workspace_name.string' => 'Workspace name must be a string',
            'workspace_name.max' => 'Workspace name cannot exceed 50 characters',
            'workspace_type.in' => 'Workspace type must be one of: ' . $validTypesString,
        ];
    }
}
