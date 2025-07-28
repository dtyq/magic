<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Create file or folder request DTO.
 * Used to receive request parameters for creating files or folders.
 */
class CreateFileRequestDTO extends AbstractRequestDTO
{
    /**
     * Project ID.
     */
    public string $projectId = '';

    /**
     * Parent ID.
     */
    public string $parentId = '';

    /**
     * File name.
     */
    public string $fileName = '';

    /**
     * Whether it's a directory.
     */
    public bool $isDirectory = false;

    /**
     * The ID of the previous file for positioning, 0=first position, -1=last position (default).
     */
    public int $preFileId = -1;

    /**
     * Get project ID.
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }

    /**
     * Get parent ID.
     */
    public function getParentId(): string
    {
        return $this->parentId;
    }

    /**
     * Get file name.
     */
    public function getFileName(): string
    {
        return $this->fileName;
    }

    /**
     * Get whether it's a directory.
     */
    public function getIsDirectory(): bool
    {
        return $this->isDirectory;
    }

    /**
     * Get pre file ID for positioning.
     */
    public function getPreFileId(): int
    {
        return $this->preFileId;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'required|string',
            'parent_id' => 'nullable|string', // Allow null and empty string for root directory
            'file_name' => [
                'required',
                'string',
                'max:255',
                'regex:/^[^\/\:*?"<>|]+$/', // 禁止特殊字符
            ],
            'is_directory' => 'nullable|boolean',
            'pre_file_id' => 'integer|min:-1', // -1表示末尾，0表示第一位，>0表示指定位置
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
            'parent_id.string' => 'Parent ID must be a string',
            'file_name.required' => 'File name cannot be empty',
            'file_name.string' => 'File name must be a string',
            'file_name.max' => 'File name cannot exceed 255 characters',
            'file_name.regex' => 'File name cannot contain the following characters: / \ : * ? " < > |',
            'is_directory.boolean' => 'Is directory must be a boolean value',
            'pre_file_id.integer' => 'Pre file ID must be an integer',
            'pre_file_id.min' => 'Pre file ID must be -1 or greater',
        ];
    }
}
