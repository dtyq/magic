<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Utils;

use App\Application\MCP\Authorization\MCPAuthorizationAppService;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;

/**
 * Super Magic 运行时 MCP Authorization 凭据解析器。
 */
class MCPAuthorizationCredentialResolver
{
    public function __construct(
        private readonly MCPAuthorizationAppService $authorizationAppService
    ) {
    }

    /**
     * 返回运行时 Bearer Token；无有效凭据时返回 null。
     */
    public function resolveAccessToken(MCPDataIsolation $dataIsolation, MCPServerEntity $mcpServer): ?string
    {
        return $this->authorizationAppService->getRuntimeAccessToken($dataIsolation, $mcpServer);
    }
}
