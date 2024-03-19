<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Facade;

use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;

/**
 * Agent 版本仓储接口.
 */
interface AgentVersionRepositoryInterface
{
    /**
     * 根据 code 查找最新版本的 Agent 版本（按 version 字段降序）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Agent code
     * @return null|AgentVersionEntity 不存在返回 null
     */
    public function findLatestByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity;

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
     * @return bool 是否更新成功
     */
    public function updateReviewStatus(
        SuperMagicAgentDataIsolation $dataIsolation,
        int $id,
        ReviewStatus $reviewStatus,
        PublishStatus $publishStatus,
        string $modifier
    ): bool;

    public function deleteByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool;

    public function offlineByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool;

    /**
     * 根据 ID 查询 Agent 版本（不限制状态）.
     *
     * @param int $id Agent 版本 ID
     * @return null|AgentVersionEntity 不存在返回 null
     */
    public function findById(int $id): ?AgentVersionEntity;
}
