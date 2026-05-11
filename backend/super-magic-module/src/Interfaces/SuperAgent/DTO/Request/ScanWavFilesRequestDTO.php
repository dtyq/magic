<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Scan WAV files from object storage request DTO.
 * Scans the specified directory in object storage for .wav files and
 * persists any new ones to the task file table.
 */
class ScanWavFilesRequestDTO extends AbstractRequestDTO
{
    /**
     * Project ID.
     */
    public string $projectId = '';

    /**
     * Relative path of the target directory within the project workspace.
     * e.g. ".asr_recordings/session_xxx".
     */
    public string $relativePath = '';

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getRelativePath(): string
    {
        return $this->relativePath;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'required|string',
            'relative_path' => 'required|string',
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
            'relative_path.required' => 'Relative path cannot be empty',
            'relative_path.string' => 'Relative path must be a string',
        ];
    }
}
