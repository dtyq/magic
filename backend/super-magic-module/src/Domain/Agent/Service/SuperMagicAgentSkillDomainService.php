<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentSkillEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentSkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Hyperf\DbConnection\Annotation\Transactional;

/**
 * Agent Skill Domain Service.
 */
class SuperMagicAgentSkillDomainService
{
    public function __construct(
        protected readonly AgentSkillRepositoryInterface $agentSkillRepository,
        protected readonly SuperMagicAgentRepositoryInterface $superMagicAgentRepository
    ) {
    }

    /**
     * 全量更新 Agent 绑定的技能列表.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $agentCode Agent Code
     * @param AgentSkillEntity[] $skillEntities 技能关联实体数组
     * @return AgentSkillEntity[] 创建后的实体数组
     */
    #[Transactional]
    public function updateAgentSkills(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode, array $skillEntities): array
    {
        // 1. 删除该 Agent 的所有现有绑定关系（软删除）
        $this->agentSkillRepository->deleteByAgentCodeForCurrentVersion($dataIsolation, $agentCode);

        // 2. 如果技能列表不为空，批量创建新的绑定关系
        $result = [];
        if (! empty($skillEntities)) {
            $result = $this->agentSkillRepository->batchSave($dataIsolation, $skillEntities);
        }

        // 3. 更新 Agent 的 updated_at 时间
        $this->superMagicAgentRepository->updateUpdatedAtByCode($dataIsolation, $agentCode, $dataIsolation->getCurrentUserId());

        return $result;
    }

    /**
     * 新增 Agent 绑定的技能（增量添加）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $agentCode Agent Code
     * @param AgentSkillEntity[] $newSkillEntities 新增的技能关联实体数组
     * @return AgentSkillEntity[] 创建后的实体数组
     */
    #[Transactional]
    public function addAgentSkills(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode, array $newSkillEntities): array
    {
        if (empty($newSkillEntities)) {
            return [];
        }

        // 获取现有技能列表
        $existingSkills = $this->agentSkillRepository->getByAgentCodeAndSkillCodesForCurrentVersion($dataIsolation, $agentCode);

        // 获取现有技能的 code 集合，用于去重
        $existingSkillCodes = [];
        foreach ($existingSkills as $existingSkill) {
            $existingSkillCodes[$existingSkill->getSkillCode()] = true;
        }

        // 过滤掉已存在的技能，并设置正确的 sort_order
        $maxSortOrder = 0;
        if (! empty($existingSkills)) {
            $maxSortOrder = max(array_map(fn ($skill) => $skill->getSortOrder(), $existingSkills));
        }

        $skillsToAdd = [];
        foreach ($newSkillEntities as $index => $newSkillEntity) {
            $skillCode = $newSkillEntity->getSkillCode();
            if (isset($existingSkillCodes[$skillCode])) {
                // 跳过已存在的技能
                continue;
            }
            $newSkillEntity->setSortOrder($maxSortOrder + $index + 1);
            $skillsToAdd[] = $newSkillEntity;
        }

        if (empty($skillsToAdd)) {
            return [];
        }

        $result = $this->agentSkillRepository->batchSave($dataIsolation, $skillsToAdd);

        // 更新 Agent 的 updated_at 时间
        $this->superMagicAgentRepository->updateUpdatedAtByCode($dataIsolation, $agentCode, $dataIsolation->getCurrentUserId());

        return $result;
    }

    /**
     * 删除 Agent 绑定的技能（增量删除）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $agentCode Agent Code
     * @param array $skillCodesToRemove 要删除的技能 code 列表
     * @return int 成功数量
     */
    #[Transactional]
    public function removeAgentSkills(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode, array $skillCodesToRemove): int
    {
        if (empty($skillCodesToRemove)) {
            return 0;
        }
        // 根据 agent_code 和 skill_codes 查询当前版本的技能绑定关系（agent_version_id 为 NULL）
        $currentVersionSkills = $this->agentSkillRepository->getByAgentCodeAndSkillCodesForCurrentVersion($dataIsolation, $agentCode, $skillCodesToRemove);

        // 检查数据是否匹配上 skillCodesToRemove 数量
        $skillCodesToRemoveCount = count(array_unique($skillCodesToRemove));
        if (count($currentVersionSkills) !== $skillCodesToRemoveCount) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'super_magic.agent.skill_not_found_or_not_match');
        }

        // 过滤出 skill_code 匹配的记录 ID
        $skillCodesToRemoveMap = array_flip($skillCodesToRemove);
        $idsToDelete = [];
        foreach ($currentVersionSkills as $skill) {
            if (isset($skillCodesToRemoveMap[$skill->getSkillCode()])) {
                $idsToDelete[] = $skill->getId();
            }
        }

        // 根据 IDs 批量删除
        if (! empty($idsToDelete)) {
            $this->agentSkillRepository->deleteByIds($dataIsolation, $idsToDelete);
        }

        // 更新 Agent 的 updated_at 时间
        $this->superMagicAgentRepository->updateUpdatedAtByCode($dataIsolation, $agentCode, $dataIsolation->getCurrentUserId());

        return $skillCodesToRemoveCount;
    }
}
