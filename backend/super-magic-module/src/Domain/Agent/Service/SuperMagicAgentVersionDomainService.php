<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\AgentVersionQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentVersionRepositoryInterface;

/**
 * Agent 版本领域服务.
 */
class SuperMagicAgentVersionDomainService
{
    public function __construct(
        protected AgentVersionRepositoryInterface $agentVersionRepository
    ) {
    }

    /**
     * @return array{total:int, list: array<AgentVersionEntity>}
     */
    public function queriesByCode(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code,
        ?PublishTargetType $publishTargetType = null,
        ?ReviewStatus $reviewStatus = null,
        Page $page = new Page()
    ): array {
        return $this->agentVersionRepository->queriesByCode($dataIsolation, $code, $publishTargetType, $reviewStatus, $page);
    }

    public function countVersionsByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): int
    {
        return $this->agentVersionRepository->countByCode($dataIsolation, $code);
    }

    public function findLatestVersionByCreatedAt(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity
    {
        return $this->agentVersionRepository->findLatestByCreatedAtDesc($dataIsolation, $code);
    }

    public function getCurrentOrLatestByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity
    {
        return $this->agentVersionRepository->findCurrentOrLatestByCode($dataIsolation, $code);
    }

    /**
     * Return a version snapshot by id without organization scoping.
     */
    public function findByIdWithoutOrganizationFilter(int $id): ?AgentVersionEntity
    {
        return $this->agentVersionRepository->findById($id);
    }

    /**
     * @param array<string> $codes
     * @return array<string, AgentVersionEntity>
     */
    public function getCurrentOrLatestByCodes(SuperMagicAgentDataIsolation $dataIsolation, array $codes): array
    {
        return $this->agentVersionRepository->findCurrentOrLatestByCodes($dataIsolation, $codes);
    }

    /**
     * @return array{total: int, list: AgentVersionEntity[]}
     */
    public function queries(
        SuperMagicAgentDataIsolation $dataIsolation,
        AgentVersionQuery $query,
        Page $page
    ): array {
        return $this->agentVersionRepository->queries($dataIsolation, $query, $page);
    }

    /**
     * @param array<int> $ids
     * @return array<int, AgentVersionEntity>
     */
    public function findByIdsWithoutOrganizationFilter(array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids)));
        if ($ids === []) {
            return [];
        }

        $result = [];
        foreach ($ids as $id) {
            $entity = $this->agentVersionRepository->findById((int) $id);
            if ($entity !== null) {
                $result[(int) $id] = $entity;
            }
        }

        return $result;
    }

    /**
     * 管理后台：跨组织分页查询 Agent 版本列表.
     *
     * @return array{list: AgentVersionEntity[], total: int}
     */
    public function queryVersions(
        SuperMagicAgentDataIsolation $dataIsolation,
        ?string $reviewStatus,
        ?string $publishStatus,
        ?string $publishTargetType,
        ?string $version,
        ?string $startTime,
        ?string $endTime,
        string $orderBy,
        Page $page
    ): array {
        return $this->agentVersionRepository->queryVersions(
            $dataIsolation,
            $reviewStatus,
            $publishStatus,
            $publishTargetType,
            $version,
            $startTime,
            $endTime,
            $orderBy,
            $page
        );
    }
}
