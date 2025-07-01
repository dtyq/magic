<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\ExecutionData;

class ExecutionDataCollector
{
    public const int MAX_COUNT = 5000;

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

    public static function remove(string $uniqueId): void
    {
        unset(self::$executionList[$uniqueId], self::$nodeExecuteCount[$uniqueId]);
    }
}
