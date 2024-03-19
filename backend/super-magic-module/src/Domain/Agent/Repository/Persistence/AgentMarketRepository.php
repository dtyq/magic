<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentMarketRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\AgentMarketModel;

/**
 * 市场 Agent 仓储实现.
 */
class AgentMarketRepository extends AbstractRepository implements AgentMarketRepositoryInterface
{
    public function __construct(
        protected AgentMarketModel $agentMarketModel
    ) {
    }

    /**
     * 根据 agent_code 查询市场状态（仅查询已发布的）.
     */
    public function findByAgentCode(string $agentCode): ?AgentMarketEntity
    {
        /** @var null|AgentMarketModel $model */
        $model = $this->agentMarketModel::query()
            ->where('agent_code', $agentCode)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->first();

        if (! $model) {
            return null;
        }

        return new AgentMarketEntity($model->toArray());
    }

    /**
     * 批量根据 agent_code 列表查询市场状态（仅查询已发布的）.
     */
    public function findByAgentCodes(array $agentCodes): array
    {
        if (empty($agentCodes)) {
            return [];
        }

        $models = $this->agentMarketModel::query()
            ->whereIn('agent_code', $agentCodes)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->get();

        $result = [];
        foreach ($models as $model) {
            $entity = new AgentMarketEntity($model->toArray());
            $result[$entity->getAgentCode()] = $entity;
        }

        return $result;
    }

    /**
     * 根据 agent_code 查询市场记录（不限制发布状态）.
     */
    public function findByAgentCodeWithoutStatus(string $agentCode): ?AgentMarketEntity
    {
        /** @var null|AgentMarketModel $model */
        $model = $this->agentMarketModel::query()
            ->where('agent_code', $agentCode)
            ->first();

        if (! $model) {
            return null;
        }

        return new AgentMarketEntity($model->toArray());
    }

    /**
     * 保存或更新市场 Agent 记录.
     */
    public function saveOrUpdate(SuperMagicAgentDataIsolation $dataIsolation, AgentMarketEntity $entity): AgentMarketEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentMarketModel::query());

        // 检查是否已存在
        $existingModel = $builder->where('agent_code', $entity->getAgentCode())
            ->first();

        $attributes = $this->getAttributes($entity);
        if ($entity->getOrganizationCode()) {
            $attributes['organization_code'] = $entity->getOrganizationCode();
        }
        if ($existingModel) {
            // 更新
            $existingModel->fill($attributes);
            $existingModel->save();
            return new AgentMarketEntity($existingModel->toArray());
        }

        // 新增
        $attributes['id'] = IdGenerator::getSnowId();
        $attributes['created_at'] = date('Y-m-d H:i:s');
        $entity->setId($attributes['id']);
        $entity->setCreatedAt($attributes['created_at']);
        $entity->setUpdatedAt($attributes['created_at']);

        $this->agentMarketModel::query()->create($attributes);

        return $entity;
    }

    public function offlineByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentMarketModel::query());

        $builder->where('agent_code', $agentCode)
            ->whereIn('publish_status', [PublishStatus::PUBLISHED->value])
            ->update(
                ['publish_status' => PublishStatus::OFFLINE->value]
            );

        return true;
    }

    /**
     * 查询市场员工列表.
     *
     * @return array{total: int, list: array<AgentMarketEntity>}
     */
    public function queries(AgentMarketQuery $query, Page $page): array
    {
        $builder = $this->agentMarketModel::query()
            ->where('publish_status', PublishStatus::PUBLISHED->value);

        // 关键词搜索：在 name_i18n、role_i18n 和 description_i18n JSON 字段中搜索
        if (! empty($query->getKeyword()) && ! empty($query->getLanguageCode())) {
            $keyword = $query->getKeyword();
            $languageCode = $query->getLanguageCode();
            $builder->where(function ($q) use ($keyword, $languageCode) {
                $q->whereRaw(
                    "JSON_EXTRACT(name_i18n, CONCAT('$.', ?)) LIKE ?",
                    [$languageCode, '%' . $keyword . '%']
                )->orWhereRaw(
                    "JSON_EXTRACT(role_i18n, CONCAT('$.', ?)) LIKE ?",
                    [$languageCode, '%' . $keyword . '%']
                )->orWhereRaw(
                    "JSON_EXTRACT(description_i18n, CONCAT('$.', ?)) LIKE ?",
                    [$languageCode, '%' . $keyword . '%']
                );
            });
        }

        // 分类筛选
        if ($query->getCategoryId() !== null) {
            $builder->where('category_id', $query->getCategoryId());
        }

        // 排序：按 created_at DESC
        $builder->orderBy('created_at', 'DESC');

        // 分页查询
        $result = $this->getByPage($builder, $page, $query);

        $list = [];
        /** @var AgentMarketModel $model */
        foreach ($result['list'] as $model) {
            $entity = new AgentMarketEntity($model->toArray());
            $list[] = $entity;
        }
        $result['list'] = $list;

        return $result;
    }

    /**
     * 根据 agent_code 查询市场员工（仅查询已发布的）.
     */
    public function findByAgentCodeForHire(string $agentCode): ?AgentMarketEntity
    {
        /** @var null|AgentMarketModel $model */
        $model = $this->agentMarketModel::query()
            ->where('agent_code', $agentCode)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->first();

        if (! $model) {
            return null;
        }

        return new AgentMarketEntity($model->toArray());
    }

    /**
     * 增加市场员工的安装次数.
     */
    public function incrementInstallCount(int $agentMarketId): bool
    {
        $affected = $this->agentMarketModel::query()
            ->where('id', $agentMarketId)
            ->increment('install_count');

        return $affected > 0;
    }
}
