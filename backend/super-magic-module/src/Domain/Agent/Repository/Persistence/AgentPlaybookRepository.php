<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentPlaybookRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\AgentPlaybookModel;
use Hyperf\Codec\Json;

/**
 * Agent Playbook 仓储实现.
 */
class AgentPlaybookRepository extends SuperMagicAbstractRepository implements AgentPlaybookRepositoryInterface
{
    public function __construct(
        protected AgentPlaybookModel $agentPlaybookModel
    ) {
    }

    public function getByAgentCodeForCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode, ?bool $isEnabled = null): array
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentPlaybookModel::query());

        $builder = $builder
            ->select(['id',
                'organization_code',
                'agent_id',
                'agent_version_id',
                'agent_code',
                'name_i18n',
                'description_i18n',
                'icon',
                'theme_color',
                'is_enabled',
                'sort_order', ])
            ->where('agent_code', $agentCode)
            ->whereNull('agent_version_id');

        if ($isEnabled === true) {
            $builder->where('is_enabled', 1);
        } elseif ($isEnabled === false) {
            $builder->where('is_enabled', 0);
        }

        $models = $builder
            ->orderBy('is_enabled', 'DESC')  // 已激活的排在最前面
            ->orderBy('sort_order', 'DESC')    // 数值越大越靠前
            ->orderBy('created_at', 'ASC')    // 创建时间越早越靠前
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = new AgentPlaybookEntity($model->toArray());
        }

        return $entities;
    }

    /**
     * 批量根据 agent_code 列表查询 Playbook 列表.
     */
    public function getByAgentCodesForCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, array $agentCodes, ?bool $isEnabled = null): array
    {
        if (empty($agentCodes)) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, $this->agentPlaybookModel::query());

        $builder = $builder
            ->select(['id',
                'organization_code',
                'agent_id',
                'agent_version_id',
                'agent_code',
                'name_i18n',
                'description_i18n',
                'icon',
                'theme_color',
                'is_enabled',
                'sort_order', ])
            ->whereIn('agent_code', $agentCodes)
            ->whereNull('agent_version_id')
            ->orderBy('agent_id')
            ->orderBy('sort_order', 'DESC')
            ->orderBy('created_at', 'ASC');

        if ($isEnabled !== null) {
            $builder->where('is_enabled', (int) $isEnabled);
        }

        $models = $builder->get();

        $result = [];
        foreach ($models as $model) {
            $agentCode = $model->agent_code;
            if (! isset($result[$agentCode])) {
                $result[$agentCode] = [];
            }
            $result[$agentCode][] = new AgentPlaybookEntity($model->toArray());
        }

        return $result;
    }

    /**
     * 保存 Playbook 实体.
     */
    public function save(SuperMagicAgentDataIsolation $dataIsolation, AgentPlaybookEntity $entity): AgentPlaybookEntity
    {
        if (! $entity->getId()) {
            $model = new AgentPlaybookModel();
        } else {
            $builder = $this->createBuilder($dataIsolation, $this->agentPlaybookModel::query());
            $model = $builder->where('id', $entity->getId())->first();
            if (! $model) {
                $model = new AgentPlaybookModel();
            }
        }

        // 新建时，所有字段都需要设置
        $attributes = $this->getAttributes($entity);
        /*
        // 转换 Entity 属性到 Model
        $attributes = [];
         if (! $entity->getId()) {
            $attributes = [
                'organization_code' => $entity->getOrganizationCode(),
                'agent_id' => $entity->getAgentId(),
                'agent_version_id' => $entity->getAgentVersionId(),
                'agent_code' => $entity->getAgentCode(),
                'name_i18n' => $entity->getNameI18n(),
                'description_i18n' => $entity->getDescriptionI18n(),
                'icon' => $entity->getIcon(),
                'theme_color' => $entity->getThemeColor(),
                'is_enabled' => $entity->getIsEnabled() !== null ? ($entity->getIsEnabled() ? 1 : 0) : 1,
                'sort_order' => $entity->getSortOrder() ?? 0,
                'config' => $entity->getConfig(),
                'creator_id' => $entity->getCreatorId(),
                'created_at' => date('Y-m-d H:i:s'),
            ];
        } else {
            // 更新时，只更新非 null 的字段（部分更新）
            if ($entity->getNameI18n() !== null) {
                $attributes['name_i18n'] = $entity->getNameI18n();
            }
            if ($entity->getDescriptionI18n() !== null) {
                $attributes['description_i18n'] = $entity->getDescriptionI18n();
            }
            if ($entity->getIcon() !== null) {
                $attributes['icon'] = $entity->getIcon();
            }
            if ($entity->getThemeColor() !== null) {
                $attributes['theme_color'] = $entity->getThemeColor();
            }
            if ($entity->getIsEnabled() !== null) {
                $attributes['is_enabled'] = $entity->getIsEnabled() ? 1 : 0;
            }
            if ($entity->getSortOrder() !== null) {
                $attributes['sort_order'] = $entity->getSortOrder();
            }
            if ($entity->getConfig() !== null) {
                $attributes['config'] = $entity->getConfig();
            }
        }*/

        $attributes['updated_at'] = date('Y-m-d H:i:s');

        $model->fill($attributes);
        $model->save();

        $entity->setId($model->id);
        if ($model->created_at) {
            $entity->setCreatedAt($model->created_at->format('Y-m-d H:i:s'));
        }
        if ($model->updated_at) {
            $entity->setUpdatedAt($model->updated_at->format('Y-m-d H:i:s'));
        }

        return $entity;
    }

    /**
     * 根据 id 查询 Playbook.
     */
    public function findById(SuperMagicAgentDataIsolation $dataIsolation, int $playbookId): ?AgentPlaybookEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentPlaybookModel::query());

        /** @var null|AgentPlaybookModel $model */
        $model = $builder
            ->where('id', $playbookId)
            ->first();

        if (! $model) {
            return null;
        }

        return new AgentPlaybookEntity($model->toArray());
    }

    /**
     * 删除 Playbook（软删除）.
     */
    public function deleteById(SuperMagicAgentDataIsolation $dataIsolation, int $playbookId): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentPlaybookModel::query());

        $affected = $builder
            ->where('id', $playbookId)
            ->whereNull('deleted_at')
            ->update([
                'deleted_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

        return $affected > 0;
    }

    /**
     * 更新 Playbook 排序权重.
     */
    public function updateSortOrder(SuperMagicAgentDataIsolation $dataIsolation, int $playbookId, int $sortOrder): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentPlaybookModel::query());

        $affected = $builder
            ->where('id', $playbookId)
            ->whereNull('deleted_at')
            ->update([
                'sort_order' => $sortOrder,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

        return $affected > 0;
    }

    /**
     * 批量复制 Playbook 到版本（补充 agent_version_id）.
     */
    public function batchCopyToVersion(SuperMagicAgentDataIsolation $dataIsolation, int $agentId, int $agentVersionId): array
    {
        // 1. 查询当前 Agent 的所有 Playbook（未删除的）
        $builder = $this->createBuilder($dataIsolation, $this->agentPlaybookModel::query());
        $models = $builder
            ->where('agent_id', $agentId)
            ->whereNull('deleted_at')
            ->orderBy('sort_order', 'DESC')
            ->get();

        if ($models->isEmpty()) {
            return [];
        }

        // 2. 复制这些 Playbook，设置 agent_version_id
        $now = date('Y-m-d H:i:s');
        $insertData = [];
        $result = [];

        foreach ($models as $model) {
            $data = $model->toArray();
            $insertData[] = [
                'id' => IdGenerator::getSnowId(),
                'organization_code' => $data['organization_code'],
                'agent_id' => $agentId,
                'agent_version_id' => $agentVersionId,
                'agent_code' => $data['agent_code'],
                'name_i18n' => $data['name_i18n'] ? Json::encode($data['name_i18n']) : null,
                'description_i18n' => $data['description_i18n'] ? Json::encode($data['description_i18n']) : null,
                'icon' => $data['icon'],
                'theme_color' => $data['theme_color'],
                'is_enabled' => $data['is_enabled'],
                'sort_order' => $data['sort_order'],
                'config' => $data['config'] ? Json::encode($data['config']) : null,
                'creator_id' => $data['creator_id'],
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // 3. 批量插入
        $this->agentPlaybookModel::query()->insert($insertData);

        // 4. 转换为实体数组
        foreach ($insertData as $data) {
            $result[] = new AgentPlaybookEntity($data);
        }

        return $result;
    }

    public function deleteByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentPlaybookModel::query());

        $builder->where('agent_code', $agentCode)
            ->delete();

        return true;
    }

    /**
     * 批量根据 agent_version_id 列表查询 Playbook 列表（用于商店员工列表）.
     *
     * @return array<int, AgentPlaybookEntity[]> 按 agent_version_id 分组的 Playbook 实体数组，key 为 agent_version_id
     */
    public function getByAgentVersionIds(array $agentVersionIds): array
    {
        if (empty($agentVersionIds)) {
            return [];
        }

        $models = $this->agentPlaybookModel::query()
            ->whereIn('agent_version_id', $agentVersionIds)
            ->where('is_enabled', 1)
            ->whereNull('deleted_at')
            ->orderBy('agent_version_id')
            ->orderBy('sort_order', 'DESC')
            ->orderBy('created_at', 'ASC')
            ->get();

        $result = [];
        foreach ($models as $model) {
            $agentVersionId = $model->agent_version_id;
            if (! isset($result[$agentVersionId])) {
                $result[$agentVersionId] = [];
            }
            $result[$agentVersionId][] = new AgentPlaybookEntity($model->toArray());
        }

        return $result;
    }
}
