<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Facade;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;

/**
 * 市场 Agent 仓储接口.
 */
interface AgentMarketRepositoryInterface
{
    /**
     * 根据 agent_code 查询市场状态（仅查询已发布的）.
     *
     * @param string $agentCode Agent code
     * @return null|AgentMarketEntity 市场 Agent 实体，不存在返回 null
     */
    public function findByAgentCode(string $agentCode): ?AgentMarketEntity;

    /**
     * 批量根据 agent_code 列表查询市场状态（仅查询已发布的）.
     *
     * @param string[] $agentCodes Agent code 列表
     * @return array<string, AgentMarketEntity> 市场 Agent 实体数组，key 为 agent_code
     */
    public function findByAgentCodes(array $agentCodes): array;

    /**
     * 批量根据市场记录 ID 列表查询市场记录（不限制发布状态）.
     *
     * @param int[] $ids 市场记录 ID 列表
     * @return array<int, AgentMarketEntity> 市场 Agent 实体数组，key 为 id
     */
    public function findByIds(array $ids): array;

    /**
     * 根据 agent_code 查询市场记录（不限制发布状态）.
     *
     * @param string $agentCode Agent code
     * @return null|AgentMarketEntity 市场 Agent 实体，不存在返回 null
     */
    public function findByAgentCodeWithoutStatus(string $agentCode): ?AgentMarketEntity;

    /**
     * 保存或更新市场 Agent 记录.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param AgentMarketEntity $entity 市场 Agent 实体
     * @return AgentMarketEntity 保存后的实体
     */
    public function saveOrUpdate(SuperMagicAgentDataIsolation $dataIsolation, AgentMarketEntity $entity): AgentMarketEntity;

    public function offlineByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool;

    /**
     * 查询市场员工列表.
     *
     * @param AgentMarketQuery $query 查询条件
     * @param Page $page 分页对象
     * @return array{total: int, list: array<AgentMarketEntity>}
     */
    public function queries(AgentMarketQuery $query, Page $page): array;

    /**
     * 根据 agent_code 查询市场员工（仅查询已发布的）.
     *
     * @param string $agentCode Agent code
     * @return null|AgentMarketEntity 市场 Agent 实体，不存在返回 null
     */
    public function findByAgentCodeForHire(string $agentCode): ?AgentMarketEntity;

    /**
     * 增加市场员工的安装次数.
     *
     * @param int $agentMarketId 市场员工 ID
     * @return bool 是否更新成功
     */
    public function incrementInstallCount(int $agentMarketId): bool;
}
