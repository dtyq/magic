<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Service;

use App\Domain\MCP\Entity\MCPUserSettingEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPUserSettingQuery;
use App\Domain\MCP\Repository\Facade\MCPUserSettingRepositoryInterface;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use DateTime;

readonly class MCPUserSettingDomainService
{
    public function __construct(
        private MCPUserSettingRepositoryInterface $mcpUserSettingRepository
    ) {
    }

    public function getById(MCPDataIsolation $dataIsolation, int $id): ?MCPUserSettingEntity
    {
        return $this->mcpUserSettingRepository->getById($dataIsolation, $id);
    }

    public function getByUserAndMcpServer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId): ?MCPUserSettingEntity
    {
        return $this->mcpUserSettingRepository->getByUserAndMcpServer($dataIsolation, $userId, $mcpServerId);
    }

    /**
     * @return array<MCPUserSettingEntity>
     */
    public function getByUserId(MCPDataIsolation $dataIsolation, string $userId): array
    {
        return $this->mcpUserSettingRepository->getByUserId($dataIsolation, $userId);
    }

    /**
     * @return array<MCPUserSettingEntity>
     */
    public function getByMcpServerId(MCPDataIsolation $dataIsolation, string $mcpServerId): array
    {
        return $this->mcpUserSettingRepository->getByMcpServerId($dataIsolation, $mcpServerId);
    }

    /**
     * @return array{total: int, list: array<MCPUserSettingEntity>}
     */
    public function queries(MCPDataIsolation $dataIsolation, MCPUserSettingQuery $query, Page $page): array
    {
        return $this->mcpUserSettingRepository->queries($dataIsolation, $query, $page);
    }

    public function save(MCPDataIsolation $dataIsolation, MCPUserSettingEntity $savingEntity): MCPUserSettingEntity
    {
        $savingEntity->setCreator($dataIsolation->getCurrentUserId());
        $savingEntity->setModifier($dataIsolation->getCurrentUserId());
        $savingEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

        if (! $savingEntity->getId()) {
            // Creating new entity
            $entity = clone $savingEntity;
            $entity->prepareForCreation();
        } else {
            // Updating existing entity
            $entity = $this->mcpUserSettingRepository->getById($dataIsolation, $savingEntity->getId());
            if (! $entity) {
                ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $savingEntity->getId()]);
            }

            // Update entity properties
            $entity->setUserId($savingEntity->getUserId());
            $entity->setMcpServerId($savingEntity->getMcpServerId());
            $entity->setRequireFields($savingEntity->getRequireFields());
            $entity->setOauth2AuthResult($savingEntity->getOauth2AuthResult());
            $entity->setAdditionalConfig($savingEntity->getAdditionalConfig());
            $entity->setModifier($dataIsolation->getCurrentUserId());
            $entity->setUpdatedAt(new DateTime());
        }

        return $this->mcpUserSettingRepository->save($dataIsolation, $entity);
    }

    public function updateAdditionalConfig(MCPDataIsolation $dataIsolation, string $mcpServerId, string $additionalKey, array $additionalValue): void
    {
        $this->mcpUserSettingRepository->updateAdditionalConfig($dataIsolation, $mcpServerId, $additionalKey, $additionalValue);
    }

    public function delete(MCPDataIsolation $dataIsolation, int $id): bool
    {
        $entity = $this->mcpUserSettingRepository->getById($dataIsolation, $id);
        if (! $entity) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $id]);
        }

        return $this->mcpUserSettingRepository->delete($dataIsolation, $id);
    }
}
