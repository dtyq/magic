<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\MCP;

use Dtyq\PhpMcp\Server\FastMcp\Tools\RegisteredTool;

interface BuiltInMCPServerInterface
{
    public function getServerCode(): string;

    public function getServerName(): string;

    public static function match(string $mcpServerCode): bool;

    /**
     * @return array<RegisteredTool>
     */
    public function getRegisteredTools(string $mcpServerCode): array;
}
