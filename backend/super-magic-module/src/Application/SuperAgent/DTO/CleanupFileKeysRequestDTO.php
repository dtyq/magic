<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\DTO;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * File Key Cleanup Request DTO.
 */
class CleanupFileKeysRequestDTO extends AbstractRequestDTO
{
    /**
     * Filter by project ID.
     */
    public string $projectId = '';

    /**
     * Process specific file key.
     */
    public string $fileKey = '';

    /**
     * Dry run mode (preview only, no actual deletion).
     */
    public bool $dryRun = false;

    /**
     * Get project ID with type conversion.
     */
    public function getProjectId(): ?int
    {
        if ($this->projectId === '') {
            return null;
        }
        return (int) $this->projectId;
    }

    /**
     * Set project ID.
     */
    public function setProjectId(string $projectId): void
    {
        $this->projectId = $projectId;
    }

    /**
     * Get file key.
     */
    public function getFileKey(): ?string
    {
        if ($this->fileKey === '') {
            return null;
        }
        return $this->fileKey;
    }

    /**
     * Set file key.
     */
    public function setFileKey(string $fileKey): void
    {
        $this->fileKey = $fileKey;
    }

    /**
     * Get dry run mode.
     */
    public function getDryRun(): bool
    {
        return $this->dryRun;
    }

    /**
     * Set dry run mode with type conversion.
     */
    public function setDryRun(mixed $dryRun): void
    {
        if ($dryRun === null || $dryRun === '') {
            $this->dryRun = false;
            return;
        }

        // Handle various input types
        if (is_bool($dryRun)) {
            $this->dryRun = $dryRun;
            return;
        }

        // Handle string "true"/"false", "1"/"0", "yes"/"no"
        if (is_string($dryRun)) {
            $this->dryRun = in_array(strtolower($dryRun), ['true', '1', 'yes'], true);
            return;
        }

        // Handle numeric values
        $this->dryRun = (bool) $dryRun;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'nullable|string|regex:/^\d+$/',
            'file_key' => 'nullable|string|max:500',
            'dry_run' => 'nullable',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_id.string' => 'Project ID must be a string',
            'project_id.regex' => 'Project ID must be a valid numeric string',
            'file_key.string' => 'File key must be a string',
            'file_key.max' => 'File key cannot exceed 500 characters',
        ];
    }
}
