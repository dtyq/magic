<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\ExecutionData;

use App\Domain\Flow\Entity\MagicFlowEntity;

class ExecutionFlowCollector
{
    protected static array $flows = [];

    public static function getOrCreate(string $key, MagicFlowEntity $magicFlowEntity): MagicFlowEntity
    {
        return self::$flows[$key] ??= $magicFlowEntity;
    }

    public static function add(string $key, MagicFlowEntity $magicFlowEntity): void
    {
        self::$flows[$key] = $magicFlowEntity;
    }

    public static function get(string $key): ?MagicFlowEntity
    {
        return self::$flows[$key] ?? null;
    }

    public static function remove(string $key): void
    {
        unset(self::$flows[$key]);
    }

    public static function count(): int
    {
        return count(self::$flows);
    }
}
