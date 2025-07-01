<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Create project request DTO
 * Used to receive request parameters for creating project.
 */
class CreateProjectRequestDTO extends AbstractRequestDTO
{
    /**
     * Workspace ID.
     */
    public string $workspaceId = '';

    /**
     * Project name.
     */
    public string $projectName = '';

    /**
     * Project description.
     */
    public string $projectDescription = '';

    /**
     * Get workspace ID.
     */
    public function getWorkspaceId(): int
    {
        return (int) $this->workspaceId;
    }

    /**
     * Get project name.
     */
    public function getProjectName(): string
    {
        return $this->projectName;
    }

    /**
     * Get project description.
     */
    public function getProjectDescription(): string
    {
        return $this->projectDescription;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'workspace_id' => 'required|integer',
            'project_name' => 'required|string|max:100',
            'project_description' => 'nullable|string|max:500',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'workspace_id.required' => 'Workspace ID cannot be empty',
            'workspace_id.integer' => 'Workspace ID must be an integer',
            'project_name.required' => 'Project name cannot be empty',
            'project_name.max' => 'Project name cannot exceed 1 characters',
            'project_description.max' => 'Project description cannot exceed 500 characters',
        ];
    }
}
