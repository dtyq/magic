<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Constant;

/**
 * Audio Project Phase Enum.
 */
enum AudioProjectPhaseEnum: string
{
    case WAITING = 'waiting';         // Waiting/Initial phase (before any processing)
    case MERGING = 'merging';         // Audio merging phase
    case SUMMARIZING = 'summarizing'; // AI summary phase

    /**
     * Get all phase values.
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
