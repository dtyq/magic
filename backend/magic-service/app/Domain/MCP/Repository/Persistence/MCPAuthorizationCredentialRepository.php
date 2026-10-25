<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Repository\Persistence;

use App\Domain\MCP\Entity\MCPAuthorizationCredentialEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Factory\MCPAuthorizationCredentialFactory;
use App\Domain\MCP\Repository\Facade\MCPAuthorizationCredentialRepositoryInterface;
use App\Domain\MCP\Repository\Persistence\Model\MCPAuthorizationCredentialModel;

/**
 * MCP 标准授权凭据仓储实现。
 */
class MCPAuthorizationCredentialRepository extends MCPAbstractRepository implements MCPAuthorizationCredentialRepositoryInterface
{
    public function getByIssuer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId, string $issuer): ?MCPAuthorizationCredentialEntity
    {
        $model = $this->createBuilder($dataIsolation, MCPAuthorizationCredentialModel::query())
            ->where('user_id', $userId)
            ->where('mcp_server_id', $mcpServerId)
            ->where('issuer_hash', hash('sha256', $issuer))
            ->first();

        return $model instanceof MCPAuthorizationCredentialModel ? MCPAuthorizationCredentialFactory::createEntity($model) : null;
    }

    public function getByResource(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId, string $resource): ?MCPAuthorizationCredentialEntity
    {
        $model = $this->createBuilder($dataIsolation, MCPAuthorizationCredentialModel::query())
            ->where('user_id', $userId)
            ->where('mcp_server_id', $mcpServerId)
            ->where('resource_hash', hash('sha256', $resource))
            ->first();

        return $model instanceof MCPAuthorizationCredentialModel ? MCPAuthorizationCredentialFactory::createEntity($model) : null;
    }

    public function save(MCPDataIsolation $dataIsolation, MCPAuthorizationCredentialEntity $entity): MCPAuthorizationCredentialEntity
    {
        $builder = $this->createBuilder($dataIsolation, MCPAuthorizationCredentialModel::query());
        $model = $entity->getId()
            ? $builder->where('id', $entity->getId())->first()
            : $builder->where('user_id', $entity->getUserId())
                ->where('mcp_server_id', $entity->getMcpServerId())
                ->where('issuer_hash', $entity->getIssuerHash())
                ->first();

        if (! $model) {
            $model = new MCPAuthorizationCredentialModel();
        }
        $model->fill(MCPAuthorizationCredentialFactory::createModel($entity));
        $model->save();
        $entity->setId($model->id);
        return $entity;
    }

    public function deleteByIssuer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId, string $issuer): bool
    {
        return $this->createBuilder($dataIsolation, MCPAuthorizationCredentialModel::query())
            ->where('user_id', $userId)
            ->where('mcp_server_id', $mcpServerId)
            ->where('issuer_hash', hash('sha256', $issuer))
            ->delete() > 0;
    }

    public function deleteByServer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId): bool
    {
        return $this->createBuilder($dataIsolation, MCPAuthorizationCredentialModel::query())
            ->where('user_id', $userId)
            ->where('mcp_server_id', $mcpServerId)
            ->delete() > 0;
    }
}
