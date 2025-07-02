<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Service;

use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Domain\MCP\Event\MCPServerSavedEvent;
use App\Domain\MCP\Repository\Facade\MCPServerRepositoryInterface;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\AsyncEvent\AsyncEventUtil;

readonly class MCPServerDomainService
{
    public function __construct(
        private MCPServerRepositoryInterface $mcpServerRepository
    ) {
    }

    public function getByCode(MCPDataIsolation $dataIsolation, string $code): ?MCPServerEntity
    {
        return $this->mcpServerRepository->getByCode($dataIsolation, $code);
    }

    /**
     * @return array{total: int, list: array<MCPServerEntity>}
     */
    public function queries(MCPDataIsolation $dataIsolation, MCPServerQuery $query, Page $page): array
    {
        return $this->mcpServerRepository->queries($dataIsolation, $query, $page);
    }

    public function save(MCPDataIsolation $dataIsolation, MCPServerEntity $savingMCPServerEntity): MCPServerEntity
    {
        $savingMCPServerEntity->setCreator($dataIsolation->getCurrentUserId());
        $savingMCPServerEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        if ($savingMCPServerEntity->shouldCreate()) {
            $mcpServerEntity = clone $savingMCPServerEntity;
            $mcpServerEntity->prepareForCreation();
        } else {
            $mcpServerEntity = $this->mcpServerRepository->getByCode($dataIsolation, $savingMCPServerEntity->getCode());
            if (! $mcpServerEntity) {
                ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $savingMCPServerEntity->getCode()]);
            }
            $savingMCPServerEntity->prepareForModification($mcpServerEntity);
        }
        $mcpServerEntity = $this->mcpServerRepository->save($dataIsolation, $mcpServerEntity);
        AsyncEventUtil::dispatch(new MCPServerSavedEvent($mcpServerEntity, $savingMCPServerEntity->shouldCreate()));
        return $mcpServerEntity;
    }

    public function delete(MCPDataIsolation $dataIsolation, string $code): bool
    {
        $entity = $this->mcpServerRepository->getByCode($dataIsolation, $code);
        if (! $entity) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        return $this->mcpServerRepository->delete($dataIsolation, $code);
    }

    public function getOfficialMCPServerCodes(MCPDataIsolation $dataIsolation): array
    {
        $dataIsolation->setOnlyOfficialOrganization(true);
        return $this->mcpServerRepository->getOrgCodes($dataIsolation);
    }
}
