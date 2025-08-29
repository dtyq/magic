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
 */
class MoveProjectRequestDTO extends AbstractRequestDTO
{
    /**
     * Source project ID.
     */
    public string $sourceProjectId = '';

    /**
     * Target workspace ID.
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
     */
    public function getTargetWorkspaceId(): int
    {
        return (int) $this->targetWorkspaceId;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'source_project_id' => 'required|numeric',
            'target_workspace_id' => 'required|numeric',
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
            'target_workspace_id.required' => 'Target workspace ID cannot be empty',
            'target_workspace_id.numeric' => 'Target workspace ID must be a valid number',
        ];
    }
}
