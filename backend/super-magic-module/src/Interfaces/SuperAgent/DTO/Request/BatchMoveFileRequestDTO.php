<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class BatchMoveFileRequestDTO extends AbstractRequestDTO
{
    /**
     * The ID of the target parent directory.
     */
    public string $targetParentId = '';

    /**
     * The ID of the previous file for positioning.
     */
    public string $preFileId = '';

    /**
     * Array of file IDs to be moved.
     */
    public array $fileIds = [];

    /**
     * The project ID where files belong.
     */
    public string $projectId = '';

    public function getTargetParentId(): string
    {
        return $this->targetParentId;
    }

    public function getPreFileId(): string
    {
        return $this->preFileId;
    }

    public function getFileIds(): array
    {
        return $this->fileIds;
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'target_parent_id' => 'nullable|string',
            'pre_file_id' => 'nullable|string',
            'file_ids' => 'required|array|min:1',
            'file_ids.*' => 'required|string',
            'project_id' => 'required|string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'target_parent_id.string' => 'Target parent ID must be a string',
            'pre_file_id.string' => 'Pre file ID must be a string',
            'file_ids.required' => 'File IDs are required',
            'file_ids.array' => 'File IDs must be an array',
            'file_ids.min' => 'At least one file ID is required',
            'file_ids.*.required' => 'Each file ID is required',
            'file_ids.*.string' => 'Each file ID must be a string',
            'project_id.required' => 'Project ID is required',
            'project_id.string' => 'Project ID must be a string',
        ];
    }
}
