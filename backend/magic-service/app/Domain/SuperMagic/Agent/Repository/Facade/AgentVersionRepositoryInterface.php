<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Repository\Facade;

use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublishStatus;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublishTargetType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\AgentVersionAdminQuery;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\AgentVersionQuery;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\ReviewStatus;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;

/**
 * Agent 版本仓储接口.
 */
interface AgentVersionRepositoryInterface
{
    /**
     * 统计某 Agent 下版本记录总数（未软删）.
     */
    public function countByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): int;

    /**
     * 按 created_at 倒序取最新一条（未软删），与版本列表排序一致.
     */
    public function findLatestByCreatedAtDesc(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity;

    /**
     * 取当前生效版本（is_current_version = 1）.
     */
    public function findCurrentOrLatestByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity;

    /**
     * 在事务内锁定并读取当前生效版本（is_current_version = 1）.
     */
    public function findCurrentVersionByCodeForUpdate(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code
    ): ?AgentVersionEntity;

    public function findByIdForUpdate(SuperMagicAgentDataIsolation $dataIsolation, int $id): ?AgentVersionEntity;

    /**
     * 批量取当前生效版本（is_current_version = 1）.
     *
     * @param array<string> $codes
     * @return array<string, AgentVersionEntity>
     */
    public function findCurrentOrLatestByCodes(SuperMagicAgentDataIsolation $dataIsolation, array $codes): array;

    /**
     * 批量取当前生效且已发布的版本.
     *
     * @param array<string> $codes
     * @return array<string, AgentVersionEntity>
     */
    public function findLatestPublishedByCodes(SuperMagicAgentDataIsolation $dataIsolation, array $codes): array;

    /**
     * 跨组织查询当前已发布且面向公开范围的版本。
     *
     * @param array<string> $codes
     * @return array<string, AgentVersionEntity>
     */
    public function findLatestPublishedByCodesWithoutOrganizationFilter(array $codes): array;

    /**
     * 在指定 code 集合内每 code 取一条版本（由 AgentVersionQuery.is_current_versions、published_only 等决定），支持关键词与分页.
     *
     * @return array{total: int, list: AgentVersionEntity[]}
     */
    public function queries(
        SuperMagicAgentDataIsolation $dataIsolation,
        AgentVersionQuery $query,
        Page $page
    ): array;

    /**
     * 保存 Agent 版本.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param AgentVersionEntity $entity Agent 版本实体
     * @return AgentVersionEntity 保存后的实体
     */
    public function save(SuperMagicAgentDataIsolation $dataIsolation, AgentVersionEntity $entity): AgentVersionEntity;

    /**
     * 根据 ID 查询待审核的 Agent 版本（审核中状态）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param int $id Agent 版本 ID
     * @return null|AgentVersionEntity 不存在返回 null
     */
    public function findPendingReviewById(SuperMagicAgentDataIsolation $dataIsolation, int $id): ?AgentVersionEntity;

    /**
     * 更新 Agent 版本的审核状态和发布状态.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param int $id Agent 版本 ID
     * @param ReviewStatus $reviewStatus 审核状态
     * @param PublishStatus $publishStatus 发布状态
     * @param string $modifier 修改者
     * @param null|string $reviewRemark 审核说明
     * @return bool 是否更新成功
     */
    public function updateReviewStatus(
        SuperMagicAgentDataIsolation $dataIsolation,
        int $id,
        ReviewStatus $reviewStatus,
        PublishStatus $publishStatus,
        string $modifier,
        ?string $reviewRemark = null
    ): bool;

    public function deleteByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool;

    /** @return int[] */
    public function findIdsByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): array;

    public function offlineByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool;

    /**
     * 根据 ID 查询 Agent 版本（不限制状态）.
     *
     * @param int $id Agent 版本 ID
     * @return null|AgentVersionEntity 不存在返回 null
     */
    public function findById(int $id): ?AgentVersionEntity;

    public function existsByCodeAndVersion(SuperMagicAgentDataIsolation $dataIsolation, string $code, string $version): bool;

    /**
     * 将同一 code 下仍处于待审队列（PENDING、UNDER_REVIEW）的版本批量标记为 INVALIDATED（用户再次发布时调用，非管理员拒绝）.
     */
    public function invalidateAwaitingReviewVersionsByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): int;

    public function clearCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, string $code): int;

    /**
     * @return array{total:int, list: array<AgentVersionEntity>}
     */
    public function queriesByCode(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code,
        ?PublishTargetType $publishTargetType = null,
        ?ReviewStatus $reviewStatus = null,
        Page $page = new Page(),
        bool $includePublishing = false
    ): array;

    /**
     * 管理后台：跨组织分页查询 Agent 版本列表.
     *
     * @return array{list: AgentVersionEntity[], total: int}
     */
    public function queryVersions(
        SuperMagicAgentDataIsolation $dataIsolation,
        AgentVersionAdminQuery $query,
        Page $page
    ): array;
}
