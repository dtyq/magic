<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class DeleteDirectoryRequestDTO extends AbstractRequestDTO
{
    /**
     * Project ID to which the directory belongs.
     */
    public string $projectId = '';

    /**
     * Directory path to be deleted.
     */
    public string $path = '';

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'required|string|max:50',
            'path' => 'required|string|max:500',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_id.required' => 'Project ID cannot be empty',
            'project_id.string' => 'Project ID must be a string',
            'project_id.max' => 'Project ID cannot exceed 50 characters',
            'path.required' => 'Directory path cannot be empty',
            'path.string' => 'Directory path must be a string',
            'path.max' => 'Directory path cannot exceed 500 characters',
        ];
    }
}
