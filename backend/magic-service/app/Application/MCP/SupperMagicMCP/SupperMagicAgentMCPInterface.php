<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\SupperMagicMCP;

use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;

interface SupperMagicAgentMCPInterface
{
    public function createChatMessageRequestMcpConfig(MCPDataIsolation $dataIsolation, TaskContext $taskContext, array $agentIds = [], array $mcpIds = [], array $toolIds = []): ?array;
}
