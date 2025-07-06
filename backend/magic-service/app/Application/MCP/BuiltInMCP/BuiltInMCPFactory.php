<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\BuiltInMCP;

use App\Infrastructure\Core\Collector\BuiltInMCP\BuiltInMCPCollector;
use App\Infrastructure\Core\Contract\MCP\BuiltInMCPServerInterface;

class BuiltInMCPFactory
{
    public static function create(string $mcpServerCode): ?BuiltInMCPServerInterface
    {
        $serverClass = BuiltInMCPCollector::getServerClassByCode($mcpServerCode);

        if ($serverClass === null) {
            return null;
        }

        return \Hyperf\Support\make($serverClass);
    }
}
