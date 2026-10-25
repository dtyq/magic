<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Service;

use App\Domain\MCP\Entity\MCPAuthorizationCredentialEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Repository\Facade\MCPAuthorizationCredentialRepositoryInterface;
use DateTime;

/**
 * MCP 标准授权凭据领域服务。
 */
readonly class MCPAuthorizationCredentialDomainService
{
    public function __construct(
        private MCPAuthorizationCredentialRepositoryInterface $repository
    ) {
    }

    public function getByIssuer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId, string $issuer): ?MCPAuthorizationCredentialEntity
    {
        return $this->repository->getByIssuer($dataIsolation, $userId, $mcpServerId, $issuer);
    }

    public function getByResource(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId, string $resource): ?MCPAuthorizationCredentialEntity
    {
        return $this->repository->getByResource($dataIsolation, $userId, $mcpServerId, $resource);
    }

    public function save(MCPDataIsolation $dataIsolation, MCPAuthorizationCredentialEntity $entity): MCPAuthorizationCredentialEntity
    {
        if ($entity->getCreatedAt() === null) {
            $entity->setCreatedAt(new DateTime());
        }
        $entity->setUpdatedAt(new DateTime());
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $entity->setModifier($dataIsolation->getCurrentUserId());
        if ($entity->getCreator() === '') {
            $entity->setCreator($dataIsolation->getCurrentUserId());
        }
        return $this->repository->save($dataIsolation, $entity);
    }

    public function deleteByIssuer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId, string $issuer): bool
    {
        return $this->repository->deleteByIssuer($dataIsolation, $userId, $mcpServerId, $issuer);
    }

    /**
     * 删除用户在指定 MCP Server 下的全部新模式凭据。
     */
    public function deleteByServer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId): bool
    {
        return $this->repository->deleteByServer($dataIsolation, $userId, $mcpServerId);
    }
}
