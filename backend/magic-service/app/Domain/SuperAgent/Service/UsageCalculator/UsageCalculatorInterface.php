<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperAgent\Service\UsageCalculator;

/**
 * Usage calculator interface for SuperAgent tasks.
 * Provides usage information calculation for completed tasks.
 */
interface UsageCalculatorInterface
{
    /**
     * Calculate usage information for a task.
     *
     * @param int $taskId Task ID
     * @return array Usage information array, format: [
     *     "type" => "task_points",
     *     "detail" => [
     *         "consume" => 100
     *     ]
     * ]
     * Returns empty array [] if no usage data available.
     */
    public function calculateUsage(int $taskId): array;
}

