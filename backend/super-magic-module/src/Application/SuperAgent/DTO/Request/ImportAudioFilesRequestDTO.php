<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Import audio files request DTO.
 */
class ImportAudioFilesRequestDTO extends AbstractRequestDTO
{
    /**
     * Project ID.
     */
    public string $projectId = '';

    /**
     * Parent directory ID.
     */
    public string $parentId = '';

    /**
     * Files array.
     */
    public array $files = [];

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getParentId(): string
    {
        return $this->parentId;
    }

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
            'project_id' => 'required|string|max:50',
            'parent_id' => 'nullable|string|max:50',
            'files' => 'required|array|min:1|max:100',
            'files.*.file_key' => 'required|string|max:500',
            'files.*.file_name' => 'required|string|max:255',
            'files.*.file_size' => 'required|integer|min:1',
            'files.*.duration' => 'nullable|integer|min:0',
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
            'parent_id.string' => 'Parent ID must be a string',
            'parent_id.max' => 'Parent ID cannot exceed 50 characters',
            'files.required' => 'Files cannot be empty',
            'files.array' => 'Files must be an array',
            'files.min' => 'At least one file is required',
            'files.max' => 'Cannot import more than 100 files at once',
            'files.*.file_key.required' => 'File key cannot be empty',
            'files.*.file_key.string' => 'File key must be a string',
            'files.*.file_key.max' => 'File key cannot exceed 500 characters',
            'files.*.file_name.required' => 'File name cannot be empty',
            'files.*.file_name.string' => 'File name must be a string',
            'files.*.file_name.max' => 'File name cannot exceed 255 characters',
            'files.*.file_size.required' => 'File size cannot be empty',
            'files.*.file_size.integer' => 'File size must be an integer',
            'files.*.file_size.min' => 'File size must be greater than 0',
            'files.*.duration.integer' => 'Duration must be an integer',
            'files.*.duration.min' => 'Duration must be greater than or equal to 0',
        ];
    }
}
