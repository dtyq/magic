<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Service;

use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Agent\Entity\ValueObject\AgentDataIsolation;
use App\Domain\Agent\Entity\ValueObject\Query\MagicAgentQuery;
use App\Domain\Agent\Repository\Facade\AgentRepositoryInterface;
use App\Domain\Agent\Repository\Facade\AgentVersionRepositoryInterface;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowVersionQuery;
use App\Infrastructure\Core\ValueObject\Page;

readonly class AgentDomainService
{
    public function __construct(
        private AgentRepositoryInterface $agentRepository,
        private AgentVersionRepositoryInterface $agentVersionRepository
    ) {
    }

    /**
     * 查询 Agent 列表.
     *
     * @return array{total: int, list: array<MagicAgentEntity>}
     */
    public function queries(AgentDataIsolation $agentDataIsolation, MagicAgentQuery $agentQuery, Page $page): array
    {
        return $this->agentRepository->queries($agentDataIsolation, $agentQuery, $page);
    }

    /**
     * 获取组织内可用的 Agent 版本.
     *
     * @return array{total: int, list: array<MagicAgentVersionEntity>}
     */
    public function getOrgAvailableAgentIds(AgentDataIsolation $dataIsolation, MagicFLowVersionQuery $query, Page $page): array
    {
        return $this->agentVersionRepository->getOrgAvailableAgents($dataIsolation, $query, $page);
    }
}
