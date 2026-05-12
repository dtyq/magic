<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Request DTO for updating the source of a task file.
 */
class UpdateFileSourceRequestDTO extends AbstractRequestDTO
{
    /**
     * File ID.
     */
    public int $fileId = 0;

    /**
     * File source value (maps to TaskFileSource enum).
     */
    public int $source = 0;

    public function getFileId(): int
    {
        return $this->fileId;
    }

    public function getSource(): int
    {
        return $this->source;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'file_id' => 'required|integer|min:1',
            'source' => 'required|integer|min:0',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'file_id.required' => 'File ID cannot be empty',
            'file_id.integer' => 'File ID must be an integer',
            'file_id.min' => 'File ID must be greater than 0',
            'source.required' => 'Source cannot be empty',
            'source.integer' => 'Source must be an integer',
            'source.min' => 'Source must be a non-negative integer',
        ];
    }
}
