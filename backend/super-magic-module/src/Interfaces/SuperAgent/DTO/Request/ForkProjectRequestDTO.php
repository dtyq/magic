<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Fork project request DTO
 * Used to receive request parameters for forking project.
 */
class ForkProjectRequestDTO extends AbstractRequestDTO
{
    /**
     * Source project ID to fork from.
     */
    public string $sourceProjectId = '';

    /**
     * Target workspace ID to fork to.
     */
    public string $targetWorkspaceId = '';

    /**
     * Target project name.
     */
    public string $targetProjectName = '';

    /**
     * Get source project ID.
     */
    public function getSourceProjectId(): int
    {
        return (int) $this->sourceProjectId;
    }

    public function setSourceProjectId(string $sourceProjectId): void
    {
        $this->sourceProjectId = $sourceProjectId;
    }

    /**
     * Get target workspace ID.
     */
    public function getTargetWorkspaceId(): int
    {
        return (int) $this->targetWorkspaceId;
    }

    public function setTargetWorkspaceId(string $targetWorkspaceId): void
    {
        $this->targetWorkspaceId = $targetWorkspaceId;
    }

    /**
     * Get target project name.
     */
    public function getTargetProjectName(): string
    {
        return $this->targetProjectName;
    }

    public function setTargetProjectName(string $targetProjectName): void
    {
        $this->targetProjectName = $targetProjectName;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'source_project_id' => 'required|integer|min:1',
            'target_workspace_id' => 'required|integer|min:1',
            'target_project_name' => 'required|string|max:100',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'source_project_id.required' => 'Source project ID cannot be empty',
            'source_project_id.integer' => 'Source project ID must be an integer',
            'source_project_id.min' => 'Source project ID must be greater than 0',
            'target_workspace_id.required' => 'Target workspace ID cannot be empty',
            'target_workspace_id.integer' => 'Target workspace ID must be an integer',
            'target_workspace_id.min' => 'Target workspace ID must be greater than 0',
            'target_project_name.required' => 'Target project name cannot be empty',
            'target_project_name.string' => 'Target project name must be a string',
            'target_project_name.max' => 'Target project name cannot exceed 100 characters',
        ];
    }
}
