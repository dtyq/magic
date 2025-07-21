<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Service;

use App\Domain\MCP\Entity\MCPServerToolEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Repository\Facade\MCPServerToolRepositoryInterface;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class MCPServerToolDomainService
{
    public function __construct(
        protected readonly MCPServerToolRepositoryInterface $mcpServerToolRepository,
    ) {
    }

    public function getById(MCPDataIsolation $dataIsolation, int $id): ?MCPServerToolEntity
    {
        return $this->mcpServerToolRepository->getById($dataIsolation, $id);
    }

    /**
     * 根据mcpServerCode查询工具.
     * @return array<MCPServerToolEntity>
     */
    public function getByMcpServerCode(MCPDataIsolation $dataIsolation, string $mcpServerCode): array
    {
        return $this->mcpServerToolRepository->getByMcpServerCode($dataIsolation, $mcpServerCode);
    }

    /**
     * @param array<string> $mcpServerCodes
     * @return array<MCPServerToolEntity>
     */
    public function getByMcpServerCodes(MCPDataIsolation $dataIsolation, array $mcpServerCodes): array
    {
        return $this->mcpServerToolRepository->getByMcpServerCodes($dataIsolation, $mcpServerCodes);
    }

    public function save(MCPDataIsolation $dataIsolation, MCPServerToolEntity $savingEntity): MCPServerToolEntity
    {
        $savingEntity->setCreator($dataIsolation->getCurrentUserId());
        $savingEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

        if ($savingEntity->shouldCreate()) {
            $entity = clone $savingEntity;
            $entity->prepareForCreation();
        } else {
            $entity = $this->mcpServerToolRepository->getById($dataIsolation, $savingEntity->getId());
            if (! $entity) {
                ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => (string) $savingEntity->getId()]);
            }
            $savingEntity->prepareForModification($entity);
        }

        return $this->mcpServerToolRepository->save($dataIsolation, $entity);
    }

    /**
     * Batch insert multiple new tool entities.
     *
     * @param array<MCPServerToolEntity> $entities
     * @return array<MCPServerToolEntity>
     */
    public function batchInsert(MCPDataIsolation $dataIsolation, array $entities): array
    {
        if (empty($entities)) {
            return [];
        }

        $preparedEntities = [];

        foreach ($entities as $savingEntity) {
            $savingEntity->setCreator($dataIsolation->getCurrentUserId());
            $savingEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

            $entity = clone $savingEntity;
            $entity->prepareForCreation();
            $preparedEntities[] = $entity;
        }

        // Use repository batch insert
        return $this->mcpServerToolRepository->batchInsert($dataIsolation, $preparedEntities);
    }

    public function delete(MCPDataIsolation $dataIsolation, int $id): bool
    {
        return $this->mcpServerToolRepository->delete($dataIsolation, $id);
    }

    /**
     * Delete all tools for a specific MCP server.
     */
    public function deleteByMcpServerCode(MCPDataIsolation $dataIsolation, string $mcpServerCode): bool
    {
        return $this->mcpServerToolRepository->deleteByMcpServerCode($dataIsolation, $mcpServerCode);
    }

    /**
     * 根据ID和mcpServerCode联合查询工具.
     */
    public function getByIdAndMcpServerCode(MCPDataIsolation $dataIsolation, int $id, string $mcpServerCode): ?MCPServerToolEntity
    {
        return $this->mcpServerToolRepository->getByIdAndMcpServerCode($dataIsolation, $id, $mcpServerCode);
    }
}
