<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Utils\MCPExecutor;

use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\ServiceType;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class MCPExecutorFactory
{
    public static function createExecutor(MCPDataIsolation $MCPDataIsolation, MCPServerEntity $MCPServerEntity): MCPServerExecutorInterface
    {
        $class = match ($MCPServerEntity->getType()) {
            ServiceType::ExternalStreamableHttp,ServiceType::ExternalSSE => ExternalHttpExecutorInterface::class,
            ServiceType::ExternalStdio => ExternalStdioExecutorInterface::class,
            default => ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'mcp.server.not_support_check_status', ['label' => $MCPServerEntity->getType()])
        };
        return di($class);
    }
}
