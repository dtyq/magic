<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\ExecutionData;

class ExecutionDataCollector
{
    /**
     * Maximum node execution count before flow is terminated.
     */
    public const int MAX_COUNT = 5000;

    /**
     * Threshold for large flow detection.
     * Large flows will skip archiving and simplified result storage to prevent CPU intensive serialization.
     */
    public const int LARGE_FLOW_THRESHOLD = 100;

    public static array $executionList = [];

    public static array $nodeExecuteCount = [];

    public static function add(ExecutionData $executionData): void
    {
        self::$executionList[$executionData->getUniqueId()] = $executionData;
        self::$nodeExecuteCount[$executionData->getUniqueId()] = 0;
    }

    public static function get(string $uniqueId): ?ExecutionData
    {
        return self::$executionList[$uniqueId] ?? null;
    }

    public static function incrementNodeExecuteCount(string $uniqueId): void
    {
        if (isset(self::$nodeExecuteCount[$uniqueId])) {
            ++self::$nodeExecuteCount[$uniqueId];
        } else {
            self::$nodeExecuteCount[$uniqueId] = 1;
        }
    }

    public static function isMaxNodeExecuteCountReached(string $uniqueId): bool
    {
        return isset(self::$nodeExecuteCount[$uniqueId]) && self::$nodeExecuteCount[$uniqueId] >= self::MAX_COUNT;
    }

    /**
     * Check if the flow is considered a large flow.
     * Large flows skip archiving and simplified result storage to prevent CPU intensive operations.
     */
    public static function isLargeFlow(string $uniqueId): bool
    {
        return isset(self::$nodeExecuteCount[$uniqueId]) && self::$nodeExecuteCount[$uniqueId] >= self::LARGE_FLOW_THRESHOLD;
    }

    public static function remove(string $uniqueId): void
    {
        unset(self::$executionList[$uniqueId], self::$nodeExecuteCount[$uniqueId]);
    }
}
