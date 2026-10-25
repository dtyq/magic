<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Repository\Facade;

use App\Domain\MCP\Entity\MCPAuthorizationCredentialEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;

/**
 * MCP 标准授权凭据仓储接口。
 */
interface MCPAuthorizationCredentialRepositoryInterface
{
    public function getByIssuer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId, string $issuer): ?MCPAuthorizationCredentialEntity;

    public function getByResource(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId, string $resource): ?MCPAuthorizationCredentialEntity;

    public function save(MCPDataIsolation $dataIsolation, MCPAuthorizationCredentialEntity $entity): MCPAuthorizationCredentialEntity;

    public function deleteByIssuer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId, string $issuer): bool;

    /**
     * 删除用户在指定 MCP Server 下的全部新模式凭据。
     */
    public function deleteByServer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId): bool;
}
