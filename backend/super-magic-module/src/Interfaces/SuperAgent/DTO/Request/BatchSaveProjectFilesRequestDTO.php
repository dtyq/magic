<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 批量保存项目文件请求 DTO.
 */
class BatchSaveProjectFilesRequestDTO extends AbstractRequestDTO
{
    /**
     * 项目ID.
     */
    public string $projectId = '';

    /**
     * 父目录ID.
     */
    public string $parentId = '';

    /**
     * 文件数组.
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
     * 从请求中创建DTO实例.
     *
     * @param mixed $request 请求对象或数组
     * @phpstan-ignore-next-line
     */
    public static function fromRequest($request): static
    {
        if (is_object($request) && method_exists($request, 'all')) {
            $data = $request->all();
        } elseif (is_array($request)) {
            $data = $request;
        } else {
            $data = [];
        }

        /** @phpstan-ignore-next-line */
        $instance = new static();
        $instance->projectId = $data['project_id'] ?? '';
        $instance->parentId = $data['parent_id'] ?? '';
        $instance->files = $data['files'] ?? [];

        return $instance;
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
            'files.*.file_type' => 'nullable|string|max:50',
            'files.*.is_directory' => 'nullable|boolean',
            'files.*.parent_id' => 'nullable|integer|min:1',
            'files.*.pre_file_id' => 'nullable|integer|min:-1',
            'files.*.source' => 'nullable|integer|min:0',
            'files.*.storage_type' => 'nullable|string|max:50',
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
            'files.max' => 'Cannot save more than 100 files at once',
            'files.*.file_key.required' => 'File key cannot be empty',
            'files.*.file_key.string' => 'File key must be a string',
            'files.*.file_key.max' => 'File key cannot exceed 500 characters',
            'files.*.file_name.required' => 'File name cannot be empty',
            'files.*.file_name.string' => 'File name must be a string',
            'files.*.file_name.max' => 'File name cannot exceed 255 characters',
            'files.*.file_size.required' => 'File size cannot be empty',
            'files.*.file_size.integer' => 'File size must be an integer',
            'files.*.file_size.min' => 'File size must be greater than 0',
            'files.*.file_type.string' => 'File type must be a string',
            'files.*.file_type.max' => 'File type cannot exceed 50 characters',
            'files.*.is_directory.boolean' => 'Is directory must be a boolean value',
            'files.*.parent_id.integer' => 'Parent ID must be an integer',
            'files.*.parent_id.min' => 'Parent ID must be greater than 0',
            'files.*.pre_file_id.integer' => 'Pre file ID must be an integer',
            'files.*.pre_file_id.min' => 'Pre file ID must be greater than or equal to -1',
            'files.*.source.integer' => 'Source must be an integer',
            'files.*.source.min' => 'Source must be greater than or equal to 0',
            'files.*.storage_type.string' => 'Storage type must be a string',
            'files.*.storage_type.max' => 'Storage type cannot exceed 50 characters',
        ];
    }
}
