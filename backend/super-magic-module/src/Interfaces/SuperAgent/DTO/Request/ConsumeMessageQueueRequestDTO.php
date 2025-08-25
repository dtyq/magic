<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Consume message queue request DTO.
 * Used to receive request parameters for consuming message queue.
 */
class ConsumeMessageQueueRequestDTO extends AbstractRequestDTO
{
    /**
     * Force consume flag (optional).
     * If true, bypass some safety checks.
     */
    public bool $force = false;

    /**
     * Get force consume flag.
     */
    public function isForce(): bool
    {
        return $this->force;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'force' => 'nullable|boolean',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'force.boolean' => 'Force flag must be a boolean value',
        ];
    }
}
