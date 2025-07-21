<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Utils\MCPExecutor;

use Dtyq\PhpMcp\Types\Responses\ListToolsResult;
use Hyperf\Odin\Mcp\McpServerConfig;

interface MCPServerExecutorInterface
{
    public function getListToolsResult(McpServerConfig $mcpServerConfig): ?ListToolsResult;
}
