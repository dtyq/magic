<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Facade;

use Dtyq\SuperMagic\Domain\Agent\Entity\AgentSkillEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;

/**
 * Agent × Skill 关联仓储接口.
 */
interface AgentSkillRepositoryInterface
{
    /**
     * 根据 agent_code 查询当前版本的技能绑定关系（agent_version_id 为 NULL）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $agentCode Agent Code
     * @return AgentSkillEntity[] 技能关联实体数组
     */
    public function getByAgentCodeForCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): array;

    public function deleteByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool;

    /**
     * 根据 agent_code 删除当前版本的技能绑定关系（agent_version_id 为 NULL）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $agentCode Agent Code
     * @return bool 是否成功
     */
    public function deleteByAgentCodeForCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool;

    /**
     * 批量创建技能绑定关系.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param AgentSkillEntity[] $entities 技能关联实体数组
     * @return AgentSkillEntity[] 创建后的实体数组
     */
    public function batchSave(SuperMagicAgentDataIsolation $dataIsolation, array $entities): array;

    /**
     * 根据 agent_code 和 skill_codes 查询当前版本的技能绑定关系（agent_version_id 为 NULL）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $agentCode Agent Code
     * @param ?array $skillCodes Skill Code 列表
     * @return AgentSkillEntity[] 技能关联实体数组
     */
    public function getByAgentCodeAndSkillCodesForCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode, ?array $skillCodes = null): array;

    /**
     * 根据 ID 列表批量删除技能绑定关系（软删除）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param array $ids 要删除的记录 ID 列表
     * @return bool 是否成功
     */
    public function deleteByIds(SuperMagicAgentDataIsolation $dataIsolation, array $ids): bool;
}
