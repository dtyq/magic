<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Update project shortcut request DTO.
 */
class UpdateProjectShortcutRequestDTO extends AbstractRequestDTO
{
    /**
     * Whether to bind to workspace (1-bind, 0-unbind).
     */
    public int $isBindWorkspace = 0;

    /**
     * Workspace ID to bind to.
     */
    public string $workspaceId = '';

    public function getIsBindWorkspace(): int
    {
        return $this->isBindWorkspace;
    }

    public function getWorkspaceId(): string
    {
        return $this->workspaceId;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'is_bind_workspace' => 'required|integer|in:0,1',
            'workspace_id' => 'required|string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'is_bind_workspace.required' => 'Bind workspace status cannot be empty',
            'is_bind_workspace.integer' => 'Bind workspace status must be an integer',
            'is_bind_workspace.in' => 'Bind workspace status must be 0 or 1',
            'workspace_id.required' => 'Workspace ID cannot be empty',
            'workspace_id.string' => 'Workspace ID must be a string',
        ];
    }
}
