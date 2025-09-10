<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Set project shortcut request DTO
 * Used to receive request parameters for setting project shortcut.
 */
class SetProjectShortcutRequestDTO extends AbstractRequestDTO
{
    /**
     * Workspace ID to bind the project shortcut.
     */
    public string $workspaceId = '';

    /**
     * Get workspace ID.
     */
    public function getWorkspaceId(): int
    {
        return (int) $this->workspaceId;
    }

    /**
     * Set workspace ID.
     */
    public function setWorkspaceId(string $workspaceId): void
    {
        $this->workspaceId = $workspaceId;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'workspace_id' => 'required|integer|min:1',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'workspace_id.required' => 'Workspace ID is required',
            'workspace_id.integer' => 'Workspace ID must be an integer',
            'workspace_id.min' => 'Workspace ID must be greater than 0',
        ];
    }
}
