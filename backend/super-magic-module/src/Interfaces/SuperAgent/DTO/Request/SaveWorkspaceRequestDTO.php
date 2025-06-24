<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

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
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'id' => 'nullable|string',
            'workspace_name' => 'required|string|max:100',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'workspace_name.required' => 'Workspace name cannot be empty',
            'workspace_name.max' => 'Workspace name cannot exceed 100 characters',
        ];
    }

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
     * Check if this is an update operation.
     */
    public function isUpdate(): bool
    {
        return ! empty($this->id);
    }
}
