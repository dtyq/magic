<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Repository\Facade;

use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;

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
     * 查询已发布且未隐藏的市场记录并加行锁，供雇佣与撤权事务复用。
     */
    public function findPublishedByAgentCodeForUpdate(string $organizationCode, string $agentCode): ?AgentMarketEntity;

    /**
     * 查询组织共享市场记录并加行锁，协作者变更后用于同步撤权。
     */
    public function findPublishedOrganizationByAgentCodeForUpdate(string $organizationCode, string $agentCode): ?AgentMarketEntity;

    /**
     * 将协作权限中的员工 code 精确转换为当前组织的市场货架 ID。
     *
     * @param string[] $agentCodes
     * @return int[]
     */
    public function findPublishedOrganizationIdsByAgentCodes(string $organizationCode, array $agentCodes): array;

    /**
     * 将创建者拥有的组织共享员工转换为市场 ID，避免市场列表依赖 owner 协作权限。
     *
     * @return int[]
     */
    public function findPublishedOrganizationIdsByPublisher(string $organizationCode, string $publisherId): array;

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
     * 根据市场记录 ID 查询市场记录（不限制发布状态）。
     */
    public function findById(int $id): ?AgentMarketEntity;

    /**
     * 批量查询仍然可用于市场展示的记录，供向量结果做最终数据库校验。
     *
     * @param int[] $ids
     * @return array<int, AgentMarketEntity>
     */
    public function findVisibleByIds(array $ids): array;

    /**
     * Batch query market records visible to the current search context.
     *
     * @param int[] $ids
     * @return array<int, AgentMarketEntity>
     */
    public function findVisibleByIdsForSearch(array $ids, AgentMarketQuery $query): array;

    /** @return int[] IDs are returned in ascending order for keyset pagination. */
    public function findVectorIndexIds(string $afterId = '0', int $limit = 100): array;

    /** Count all records eligible for the Agent Market vector index. */
    public function countVectorIndexRecords(): int;

    /**
     * 查询引用指定分类的有效市场 Agent 数量。
     */
    public function countByCategoryId(int $categoryId): int;

    /**
     * 批量统计分类下的有效市场 Agent 数量。
     *
     * @param int[] $categoryIds
     * @param bool $publishedOnly 是否只统计已发布记录
     * @param bool $visibleOnly 是否只统计未隐藏记录
     * @return array<int, int>
     */
    public function countByCategoryIds(array $categoryIds, bool $publishedOnly = false, bool $visibleOnly = false): array;

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

    /** @return int[] */
    public function findIdsByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): array;

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
        ?array $categoryIds,
        string $orderBy,
        Page $page
    ): array;

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

    /**
     * 更新市场员工排序值.
     *
     * @param int $id 市场员工 ID
     * @param int $sortOrder 排序值
     * @return bool 是否更新成功
     */
    public function updateSortOrderById(int $id, int $sortOrder): bool;

    /**
     * 按传入字段部分更新市场员工信息.
     *
     * @param array{
     *     name_i18n?: null|array,
     *     description_i18n?: null|array,
     *     role_i18n?: null|array,
     *     icon?: null|array,
     *     icon_type?: null|int,
     *     sort_order?: null|int,
     *     is_featured?: bool,
     *     is_hidden?: bool
     * } $payload
     * @return bool 是否更新成功
     */
    public function updateInfoById(int $id, array $payload): bool;
}
