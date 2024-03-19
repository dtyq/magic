<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Facade;

use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;

/**
 * Agent Playbook 仓储接口.
 */
interface AgentPlaybookRepositoryInterface
{
    /**
     * 批量根据 agent_code 列表查询 Playbook 列表.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string[] $agentCodes Agent Code 列表
     * @return array<int, AgentPlaybookEntity[]> 按 agent_id 分组的 Playbook 实体数组，key 为 agent_id
     */
    public function getByAgentCodesForCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, array $agentCodes, ?bool $isEnabled = null): array;

    /**
     * 根据 agent_code 查询当前版本的 Playbook 列表.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $agentCode Agent Code
     * @param null|bool $isEnabled 是否只查询激活的 Playbook：true=仅返回已激活, false=仅返回未激活, null=返回全部
     * @return AgentPlaybookEntity[] Playbook 实体数组
     */
    public function getByAgentCodeForCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode, ?bool $isEnabled = null): array;

    /**
     * 保存 Playbook 实体.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param AgentPlaybookEntity $entity Playbook 实体
     * @return AgentPlaybookEntity 保存后的 Playbook 实体
     */
    public function save(SuperMagicAgentDataIsolation $dataIsolation, AgentPlaybookEntity $entity): AgentPlaybookEntity;

    /**
     * 根据 id 查询 Playbook.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param int $playbookId Playbook ID
     * @return null|AgentPlaybookEntity Playbook 实体，不存在返回 null
     */
    public function findById(SuperMagicAgentDataIsolation $dataIsolation, int $playbookId): ?AgentPlaybookEntity;

    /**
     * 删除 Playbook（软删除）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param int $playbookId Playbook ID
     * @return bool 是否删除成功
     */
    public function deleteById(SuperMagicAgentDataIsolation $dataIsolation, int $playbookId): bool;

    /**
     * 更新 Playbook 排序权重.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param int $playbookId Playbook ID
     * @param int $sortOrder 排序权重
     * @return bool 是否更新成功
     */
    public function updateSortOrder(SuperMagicAgentDataIsolation $dataIsolation, int $playbookId, int $sortOrder): bool;

    /**
     * 批量复制 Playbook 到版本（补充 agent_version_id）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param int $agentId Agent ID
     * @param int $agentVersionId Agent 版本 ID
     * @return AgentPlaybookEntity[] 复制后的 Playbook 实体数组
     */
    public function batchCopyToVersion(SuperMagicAgentDataIsolation $dataIsolation, int $agentId, int $agentVersionId): array;

    public function deleteByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool;

    /**
     * 批量根据 agent_version_id 列表查询 Playbook 列表（用于商店员工列表）.
     *
     * @param int[] $agentVersionIds Agent 版本 ID 列表
     * @return array<int, AgentPlaybookEntity[]> 按 agent_version_id 分组的 Playbook 实体数组，key 为 agent_version_id
     */
    public function getByAgentVersionIds(array $agentVersionIds): array;
}
