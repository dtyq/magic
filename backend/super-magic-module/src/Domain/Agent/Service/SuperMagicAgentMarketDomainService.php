<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\UserAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentMarketRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentPlaybookRepositoryInterface;

/**
 * Agent Market 领域服务.
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
     * 查询市场员工列表.
     *
     * @param AgentMarketQuery $query 查询条件
     * @param Page $page 分页对象
     * @return array{total: int, list: array<AgentMarketEntity>}
     */
    public function queries(AgentMarketQuery $query, Page $page): array
    {
        return $this->agentMarketRepository->queries($query, $page);
    }

    /**
     * 根据市场 agent_code 列表查询当前用户已安装的 Agent.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string[] $agentCodes 市场 agent_code 列表
     * @return array<string, UserAgentEntity> 用户安装关系数组，key 为市场 agent_code
     */
    public function getUserAgentsByAgentCodes(SuperMagicAgentDataIsolation $dataIsolation, array $agentCodes): array
    {
        $agentCodes = array_values(array_unique(array_filter($agentCodes)));
        if ($agentCodes === []) {
            return [];
        }

        $marketAgents = $this->agentMarketRepository->findByAgentCodes($agentCodes);
        if ($marketAgents === []) {
            return [];
        }

        $agentVersionIds = [];
        foreach ($marketAgents as $marketAgent) {
            $agentVersionIds[] = $marketAgent->getAgentVersionId();
        }

        $userAgentOwnerships = $this->userAgentDomainService->findUserAgentOwnershipsByVersionIds($dataIsolation, $agentVersionIds);
        if ($userAgentOwnerships === []) {
            return [];
        }

        $result = [];
        foreach ($marketAgents as $marketAgentCode => $marketAgent) {
            $userAgentOwnership = $userAgentOwnerships[$marketAgent->getAgentVersionId()] ?? null;
            if ($userAgentOwnership === null) {
                continue;
            }

            $result[$marketAgentCode] = $userAgentOwnership;
        }

        return $result;
    }

    /**
     * 批量根据 agent_version_id 列表查询 Playbook 列表（用于商店员工列表）.
     *
     * @param int[] $agentVersionIds Agent 版本 ID 列表
     * @return array<int, AgentPlaybookEntity[]> 按 agent_version_id 分组的 Playbook 实体数组，key 为 agent_version_id
     */
    public function getPlaybooksByAgentVersionIds(array $agentVersionIds): array
    {
        return $this->agentPlaybookRepository->getByAgentVersionIds($agentVersionIds);
    }
}
