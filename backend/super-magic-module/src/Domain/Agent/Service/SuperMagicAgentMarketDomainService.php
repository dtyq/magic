<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentMarketRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentPlaybookRepositoryInterface;

/**
 * Domain service for market agent read operations.
 */
class SuperMagicAgentMarketDomainService
{
    public function __construct(
        protected AgentPlaybookRepositoryInterface $agentPlaybookRepository,
        protected AgentMarketRepositoryInterface $agentMarketRepository,
        protected UserAgentDomainService $userAgentDomainService
    ) {
    }

    /**
     * Return a published market record by agent code.
     */
    public function getPublishedByAgentCode(string $agentCode): ?AgentMarketEntity
    {
        return $this->agentMarketRepository->findByAgentCode($agentCode);
    }

    /**
     * Query the published market list.
     *
     * @param AgentMarketQuery $query Query conditions
     * @param Page $page Page request
     * @return array{total: int, list: array<AgentMarketEntity>}
     */
    public function queries(AgentMarketQuery $query, Page $page): array
    {
        return $this->agentMarketRepository->queries($query, $page);
    }

    /**
     * 管理后台查询员工市场列表.
     *
     * @return array{total: int, list: array<AgentMarketEntity>}
     */
    public function queryAdminMarkets(
        ?string $publishStatus,
        ?string $organizationCode,
        ?string $name18n,
        ?string $publisherType,
        ?string $agentCode,
        ?string $startTime,
        ?string $endTime,
        string $orderBy,
        Page $page
    ): array {
        return $this->agentMarketRepository->queryAdminMarkets(
            $publishStatus,
            $organizationCode,
            $name18n,
            $publisherType,
            $agentCode,
            $startTime,
            $endTime,
            $orderBy,
            $page
        );
    }

    /**
     * Load playbooks in batch for the market list.
     *
     * @param int[] $agentVersionIds Agent version ids
     * @return array<int, AgentPlaybookEntity[]> Playbooks grouped by agent_version_id
     */
    public function getPlaybooksByAgentVersionIds(array $agentVersionIds): array
    {
        return $this->agentPlaybookRepository->getByAgentVersionIds($agentVersionIds);
    }

    /**
     * 更新市场员工排序值.
     */
    public function updateSortOrderById(int $id, int $sortOrder): bool
    {
        return $this->agentMarketRepository->updateSortOrderById($id, $sortOrder);
    }

    /**
     * 按传入字段部分更新市场员工信息.
     *
     * @param array{sort_order?: null|int, is_featured?: bool} $payload
     */
    public function updateInfoById(int $id, array $payload): bool
    {
        return $this->agentMarketRepository->updateInfoById($id, $payload);
    }
}
