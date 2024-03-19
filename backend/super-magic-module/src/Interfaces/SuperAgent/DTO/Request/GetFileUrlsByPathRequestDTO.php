<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class GetFileUrlsByPathRequestDTO extends AbstractRequestDTO
{
    /**
     * Project ID.
     */
    public string $projectId = '';

    /**
     * Parent file ID.
     */
    public string $parentFileId = '';

    /**
     * Relative file paths.
     */
    public array $relativeFilePaths = [];

    /**
     * Access token for share scenarios.
     */
    public string $token = '';

    /**
     * Download mode (preview, download).
     */
    public string $downloadMode = 'preview';

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getParentFileId(): string
    {
        return $this->parentFileId;
    }

    public function getRelativeFilePaths(): array
    {
        return $this->relativeFilePaths;
    }

    public function getToken(): string
    {
        return $this->token;
    }

    public function getDownloadMode(): string
    {
        return $this->downloadMode;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'required|string',
            'parent_file_id' => 'required|string',
            'relative_file_paths' => 'required|array|min:1|max:100',
            'relative_file_paths.*' => 'required|string|max:1024',
            'token' => 'nullable|string',
            'download_mode' => 'nullable|string|in:preview,download',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_id.required' => 'Project ID is required',
            'project_id.string' => 'Project ID must be a string',
            'parent_file_id.required' => 'Parent file ID is required',
            'parent_file_id.string' => 'Parent file ID must be a string',
            'relative_file_paths.required' => 'Relative file paths are required',
            'relative_file_paths.array' => 'Relative file paths must be an array',
            'relative_file_paths.min' => 'At least one file path is required',
            'relative_file_paths.max' => 'Maximum 100 file paths allowed',
            'relative_file_paths.*.required' => 'Each file path is required',
            'relative_file_paths.*.string' => 'Each file path must be a string',
            'relative_file_paths.*.max' => 'File path cannot exceed 1024 characters',
            'download_mode.in' => 'Download mode must be preview or download',
        ];
    }
}
