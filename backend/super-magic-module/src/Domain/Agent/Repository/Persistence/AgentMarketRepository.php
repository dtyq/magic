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
use Dtyq\SuperMagic\Infrastructure\Utils\DateFormatUtil;

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

    public function findByIds(array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids)));
        if ($ids === []) {
            return [];
        }

        $models = $this->agentMarketModel::query()
            ->whereIn('id', $ids)
            ->get();

        $result = [];
        foreach ($models as $model) {
            $entity = new AgentMarketEntity($model->toArray());
            if ($entity->getId() !== null) {
                $result[$entity->getId()] = $entity;
            }
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

        // 关键词搜索优先使用统一搜索字段；旧数据无该字段时回退到历史 JSON 搜索。
        if (! empty($query->getKeyword()) && ! empty($query->getLanguageCode())) {
            $keyword = mb_strtolower(trim($query->getKeyword()), 'UTF-8');
            $builder->where('search_text', 'LIKE', '%' . $keyword . '%');
        }

        // 分类筛选
        if ($query->getCategoryId() !== null) {
            $builder->where('category_id', $query->getCategoryId());
        }

        // 排序：精选优先，其次 sort_order 非空优先且数值越大越靠前；为空时回落按 id
        $builder->orderBy('is_featured', 'DESC');
        $builder->orderBy('sort_order', 'DESC');
        $builder->orderBy('id', 'DESC');

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
     * @return array{total: int, list: AgentMarketEntity[]}
     */
    public function queryAdminMarkets(
        ?string $publishStatus,
        ?string $organizationCode,
        ?string $name18n,
        ?string $publisherType,
        ?string $agentCode,
        ?string $startTime,
        ?string $endTime,
        string $orderBy,
        Page $page
    ): array {
        $builder = $this->agentMarketModel::query()
            ->whereNull('deleted_at');

        $publishStatus = trim((string) $publishStatus);
        if ($publishStatus !== '') {
            $builder->where('publish_status', $publishStatus);
        }

        $organizationCode = trim((string) $organizationCode);
        if ($organizationCode !== '') {
            $builder->where('organization_code', $organizationCode);
        }

        $publisherType = trim((string) $publisherType);
        if ($publisherType !== '') {
            $builder->where('publisher_type', $publisherType);
        }

        $agentCode = trim((string) $agentCode);
        if ($agentCode !== '') {
            $builder->where('agent_code', $agentCode);
        }

        $name18n = trim((string) $name18n);
        if ($name18n !== '') {
            $keyword = mb_strtolower(trim('%' . $name18n . '%'), 'UTF-8');
            $builder->where('search_text', 'LIKE', '%' . $keyword . '%');
        }

        $startTime = trim((string) $startTime);
        if ($startTime !== '') {
            $builder->where('created_at', '>=', DateFormatUtil::normalizeQueryRangeStart($startTime));
        }

        $endTime = trim((string) $endTime);
        if ($endTime !== '') {
            $builder->where('created_at', '<=', DateFormatUtil::normalizeQueryRangeEnd($endTime));
        }

        $idOrder = strtolower($orderBy) === 'asc' ? 'asc' : 'desc';
        $builder->orderBy('is_featured', $idOrder);
        $builder->orderBy('sort_order', $idOrder);
        $builder->orderBy('id', $idOrder);

        $result = $this->getByPage($builder, $page);
        $list = [];
        foreach ($result['list'] as $model) {
            $list[] = new AgentMarketEntity($model->toArray());
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
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

    /**
     * 更新市场员工排序值.
     */
    public function updateSortOrderById(int $id, int $sortOrder): bool
    {
        return $this->updateInfoById($id, ['sort_order' => $sortOrder]);
    }

    public function updateInfoById(int $id, array $payload): bool
    {
        /** @var null|AgentMarketModel $model */
        $model = $this->agentMarketModel::query()
            ->where('id', $id)
            ->first();

        if (! $model) {
            return false;
        }

        if (array_key_exists('sort_order', $payload)) {
            $model->sort_order = $payload['sort_order'];
        }

        if (array_key_exists('is_featured', $payload)) {
            $model->is_featured = $payload['is_featured'];
        }

        if (array_key_exists('category_id', $payload)) {
            $model->category_id = $payload['category_id'];
        }

        if ($model->isDirty() === false) {
            return true;
        }

        return $model->save();
    }
}
