<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Check fork status request DTO
 * Used to receive request parameters for checking fork status.
 */
class CheckForkStatusRequestDTO extends AbstractRequestDTO
{
    /**
     * Fork project ID to check status for.
     */
    public string $forkProjectId = '';

    /**
     * Get fork project ID.
     */
    public function getForkProjectId(): int
    {
        return (int) $this->forkProjectId;
    }

    public function setForkProjectId(string $forkProjectId): void
    {
        $this->forkProjectId = $forkProjectId;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'fork_project_id' => 'required|integer|min:1',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'fork_project_id.required' => 'Fork project ID cannot be empty',
            'fork_project_id.integer' => 'Fork project ID must be an integer',
            'fork_project_id.min' => 'Fork project ID must be greater than 0',
        ];
    }
}
