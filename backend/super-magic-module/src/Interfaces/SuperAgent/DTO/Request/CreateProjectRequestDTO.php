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
     * Project mode.
     */
    public string $projectMode = '';

    /**
     * Working directory.
     */
    public string $workdir = '';

    /**
     * Project files.
     */
    public array $files = [];

    /**
     * Get workspace ID.
     */
    public function getWorkspaceId(): int
    {
        return (int) $this->workspaceId;
    }

    public function setWorkspaceId(string $workspaceId): void
    {
        $this->workspaceId = $workspaceId;
    }

    /**
     * Get project name.
     */
    public function getProjectName(): string
    {
        return $this->projectName;
    }

    public function setProjectName(string $projectName): void
    {
        $this->projectName = $projectName;
    }

    /**
     * Get project description.
     */
    public function getProjectDescription(): string
    {
        return $this->projectDescription;
    }

    /**
     * Get project mode.
     */
    public function getProjectMode(): string
    {
        return $this->projectMode;
    }

    public function setProjectMode(string $projectMode): void
    {
        $this->projectMode = $projectMode;
    }

    /**
     * Get working directory.
     */
    public function getWorkdir(): string
    {
        return $this->workdir;
    }

    /**
     * Get project files.
     */
    public function getFiles(): array
    {
        return $this->files;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'workspace_id' => 'required|integer',
            'project_name' => 'present|string|max:100',
            'project_description' => 'nullable|string|max:500',
            'project_mode' => 'nullable|string',
            'workdir' => 'nullable|string|max:255',
            'files' => 'nullable|array|max:50',
            'files.*' => 'string',
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
            'project_name.present' => 'Project name field is required',
            'project_name.max' => 'Project name cannot exceed 100 characters',
            'project_description.max' => 'Project description cannot exceed 500 characters',
            'workdir.max' => 'Working directory cannot exceed 255 characters',
            'files.array' => 'Files must be an array',
            'files.max' => 'Files array cannot contain more than 50 items',
            'files.*.string' => 'Each file must be a string',
        ];
    }
}
