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
     * File ID of the directory to be deleted.
     */
    public string $fileId = '';

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getFileId(): string
    {
        return $this->fileId;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'required|string|max:50',
            'file_id' => 'required|string|max:50',
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
            'file_id.required' => 'File ID cannot be empty',
            'file_id.string' => 'File ID must be a string',
            'file_id.max' => 'File ID cannot exceed 50 characters',
        ];
    }
}
