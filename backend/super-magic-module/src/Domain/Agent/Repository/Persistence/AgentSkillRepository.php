<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentSkillEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentSkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\AgentSkillModel;

/**
 * Agent × Skill 关联仓储实现.
 */
class AgentSkillRepository extends SuperMagicAbstractRepository implements AgentSkillRepositoryInterface
{
    public function __construct(
        protected AgentSkillModel $agentSkillModel
    ) {
    }

    /**
     * 根据 agent_code 查询当前版本的技能绑定关系（agent_version_id 为 NULL）.
     */
    public function getByAgentCodeForCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): array
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentSkillModel::query());

        $models = $builder
            ->where('agent_code', $agentCode)
            ->whereNull('agent_version_id')
            ->orderBy('sort_order', 'ASC')
            ->orderBy('created_at', 'ASC')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = new AgentSkillEntity($model->toArray());
        }

        return $entities;
    }

    public function getByAgentVersionId(SuperMagicAgentDataIsolation $dataIsolation, int $agentVersionId): array
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentSkillModel::query());

        $models = $builder
            ->where('agent_version_id', $agentVersionId)
            ->orderBy('sort_order', 'ASC')
            ->orderBy('created_at', 'ASC')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = new AgentSkillEntity($model->toArray());
        }

        return $entities;
    }

    /**
     * 删除该 Agent 的所有现有绑定关系（软删除）.
     */
    public function deleteByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentSkillModel::query());

        $builder->where('agent_code', $agentCode)->delete();

        return true;
    }

    /**
     * 根据 agent_code 删除当前版本的技能绑定关系（agent_version_id 为 NULL）.
     */
    public function deleteByAgentCodeForCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentSkillModel::query());

        $builder
            ->where('agent_code', $agentCode)
            ->whereNull('agent_version_id')
            ->delete();

        return true;
    }

    /**
     * 批量创建技能绑定关系.
     * toArray() 会过滤 null，导致不同实体列不一致，需规范化确保每行列相同.
     */
    public function batchSave(SuperMagicAgentDataIsolation $dataIsolation, array $entities): array
    {
        if (empty($entities)) {
            return [];
        }

        $now = date('Y-m-d H:i:s');
        $insertData = [];

        foreach ($entities as $entity) {
            $entity->setCreatedAt($now);
            $entity->setUpdatedAt($now);
            $item = $entity->toArray();
            $item['id'] = IdGenerator::getSnowId();
            $item['created_at'] = $now;
            $item['updated_at'] = $now;
            $insertData[] = $item;
        }

        $this->agentSkillModel::query()->insert($insertData);

        $result = [];
        foreach ($insertData as $data) {
            $entity = new AgentSkillEntity($data);
            $result[] = $entity;
        }

        return $result;
    }

    /**
     * 根据 agent_code 和 skill_codes 查询当前版本的技能绑定关系（agent_version_id 为 NULL）.
     */
    public function getByAgentCodeAndSkillCodesForCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode, ?array $skillCodes = null): array
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentSkillModel::query());

        $models = $builder
            ->where('agent_code', $agentCode)
            ->whereNull('agent_version_id')
            ->when(! empty($skillCodes), function ($query) use ($skillCodes) {
                $query->whereIn('skill_code', $skillCodes);
            })
            ->orderBy('sort_order', 'ASC')
            ->orderBy('created_at', 'ASC')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = new AgentSkillEntity($model->toArray());
        }

        return $entities;
    }

    /**
     * 根据 ID 列表批量删除技能绑定关系（软删除）.
     */
    public function deleteByIds(SuperMagicAgentDataIsolation $dataIsolation, array $ids): bool
    {
        if (empty($ids)) {
            return true;
        }

        $builder = $this->createBuilder($dataIsolation, $this->agentSkillModel::query());

        $builder->whereIn('id', $ids)->delete();

        return true;
    }
}
