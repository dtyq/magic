<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Constant;

/**
 * Audio Project Phase Status Enum.
 */
enum AudioProjectPhaseStatusEnum: string
{
    case IN_PROGRESS = 'in_progress'; // Phase in progress
    case COMPLETED = 'completed';      // Phase completed
    case FAILED = 'failed';            // Phase failed

    /**
     * Get all status values.
     *
     * @return array<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Check if value is valid.
     */
    public static function isValid(string $value): bool
    {
        return in_array($value, self::values(), true);
    }
}
