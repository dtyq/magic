<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperAgent\Service\UsageCalculator;

/**
 * Default usage calculator implementation.
 * Returns empty array as default behavior.
 */
class DefaultUsageCalculator implements UsageCalculatorInterface
{
    /**
     * Calculate usage information for a task.
     * Default implementation returns empty array.
     *
     * @param int $taskId Task ID
     * @return array Empty array
     */
    public function calculateUsage(int $taskId): array
    {
        return [];
    }
}
