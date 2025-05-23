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

    public function getByMcpServerCode(MCPDataIsolation $dataIsolation, string $mcpServerCode): ?MCPServerToolEntity
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

    public function delete(MCPDataIsolation $dataIsolation, int $id): bool
    {
        return $this->mcpServerToolRepository->delete($dataIsolation, $id);
    }

    /**
     * 根据ID和mcpServerCode联合查询工具.
     */
    public function getByIdAndMcpServerCode(MCPDataIsolation $dataIsolation, int $id, string $mcpServerCode): ?MCPServerToolEntity
    {
        return $this->mcpServerToolRepository->getByIdAndMcpServerCode($dataIsolation, $id, $mcpServerCode);
    }
}
