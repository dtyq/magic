<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Replace file request DTO.
 */
class ReplaceFileRequestDTO extends AbstractRequestDTO
{
    /**
     * New file key in cloud storage (source file to replace with).
     */
    public string $fileKey = '';

    /**
     * New file name (optional, if not provided will keep original filename).
     */
    public string $fileName = '';

    /**
     * Whether to force replace even if file is being edited.
     */
    public bool $forceReplace = false;

    /**
     * Get file key.
     */
    public function getFileKey(): string
    {
        return $this->fileKey;
    }

    /**
     * Get file name.
     */
    public function getFileName(): string
    {
        return $this->fileName;
    }

    /**
     * Get force replace flag.
     */
    public function getForceReplace(): bool
    {
        return $this->forceReplace;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'file_key' => 'required|string',
            'file_name' => 'nullable|string|max:255|regex:/^[^\/\:*?"<>|]+$/',
            'force_replace' => 'nullable|boolean',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'file_key.required' => 'File key cannot be empty',
            'file_key.string' => 'File key must be a string',
            'file_name.string' => 'File name must be a string',
            'file_name.max' => 'File name cannot exceed 255 characters',
            'file_name.regex' => 'File name cannot contain the following characters: / \ : * ? " < > |',
            'force_replace.boolean' => 'Force replace must be a boolean value',
        ];
    }
}
