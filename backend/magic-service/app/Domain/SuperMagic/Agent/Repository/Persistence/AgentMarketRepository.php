<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Repository\Persistence;

use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentMarketType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublishStatus;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentMarketRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Persistence\Model\AgentMarketModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\SuperMagic\Utils\DateFormatUtil;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\DbConnection\Db;

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

    public function findPublishedByAgentCodeForUpdate(string $organizationCode, string $agentCode): ?AgentMarketEntity
    {
        /** @var null|AgentMarketModel $model */
        $model = $this->agentMarketModel::query()
            ->where('agent_code', $agentCode)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false)
            ->where(static function ($query) use ($organizationCode) {
                $query->where('market_type', AgentMarketType::MARKET->value)
                    ->orWhere(static function ($organizationQuery) use ($organizationCode) {
                        $organizationQuery->where('market_type', AgentMarketType::ORGANIZATION->value)
                            ->where('organization_code', $organizationCode);
                    });
            })
            ->lockForUpdate()
            ->first();

        return $model === null ? null : new AgentMarketEntity($model->toArray());
    }

    public function findPublishedOrganizationByAgentCodeForUpdate(string $organizationCode, string $agentCode): ?AgentMarketEntity
    {
        /** @var null|AgentMarketModel $model */
        $model = $this->agentMarketModel::query()
            ->where('agent_code', $agentCode)
            ->where('market_type', AgentMarketType::ORGANIZATION->value)
            ->where('organization_code', $organizationCode)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false)
            ->lockForUpdate()
            ->first();

        return $model === null ? null : new AgentMarketEntity($model->toArray());
    }

    public function findPublishedOrganizationIdsByAgentCodes(string $organizationCode, array $agentCodes): array
    {
        $agentCodes = array_values(array_unique(array_filter(array_map('strval', $agentCodes))));
        if ($organizationCode === '' || $agentCodes === []) {
            return [];
        }

        // 先转成市场 ID，主列表继续只按货架 ID 过滤，避免新增 agent_code OR 条件。
        return $this->agentMarketModel::query()
            ->where('organization_code', $organizationCode)
            ->whereIn('agent_code', $agentCodes)
            ->where('market_type', AgentMarketType::ORGANIZATION->value)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
    }

    public function findPublishedOrganizationIdsByPublisher(string $organizationCode, string $publisherId): array
    {
        if ($organizationCode === '' || $publisherId === '') {
            return [];
        }

        return $this->agentMarketModel::query()
            ->where('organization_code', $organizationCode)
            ->where('publisher_id', $publisherId)
            ->where('market_type', AgentMarketType::ORGANIZATION->value)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
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

    public function findById(int $id): ?AgentMarketEntity
    {
        /** @var null|AgentMarketModel $model */
        $model = $this->agentMarketModel::query()->find($id);
        if ($model === null) {
            return null;
        }

        return new AgentMarketEntity($model->toArray());
    }

    public function findVisibleByIds(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $models = $this->agentMarketModel::query()
            ->whereIn('id', array_values(array_unique(array_map('intval', $ids))))
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false)
            ->whereNull('deleted_at')
            ->get();

        $result = [];
        foreach ($models as $model) {
            $entity = new AgentMarketEntity($model->toArray());
            if ($entity->getId() !== null) {
                $result[(int) $entity->getId()] = $entity;
            }
        }

        return $result;
    }

    public function findVisibleByIdsForSearch(array $ids, AgentMarketQuery $query): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            return [];
        }

        $builder = $this->agentMarketModel::query()
            ->whereIn('id', $ids)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false)
            ->whereNull('deleted_at');

        if ($query->getMarketType() === AgentMarketType::ORGANIZATION) {
            $builder->where('market_type', AgentMarketType::ORGANIZATION->value)
                ->where('organization_code', $query->getVisibleOrganizationCode());
        }

        $result = [];
        foreach ($builder->get() as $model) {
            $entity = new AgentMarketEntity($model->toArray());
            if ($entity->getId() !== null) {
                $result[(int) $entity->getId()] = $entity;
            }
        }

        return $result;
    }

    public function findVectorIndexIds(string $afterId = '0', int $limit = 100): array
    {
        $afterId = max(0, (int) $afterId);
        $limit = min(100, max(1, $limit));

        return $this->agentMarketModel::query()
            ->where('id', '>', $afterId)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false)
            ->whereIn('market_type', [AgentMarketType::MARKET->value, AgentMarketType::ORGANIZATION->value])
            ->orderBy('id')
            ->limit($limit)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
    }

    public function countVectorIndexRecords(): int
    {
        return (int) $this->agentMarketModel::query()
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false)
            ->whereIn('market_type', [AgentMarketType::MARKET->value, AgentMarketType::ORGANIZATION->value])
            ->count();
    }

    public function countByCategoryId(int $categoryId): int
    {
        return $this->countByCategoryIds([$categoryId])[$categoryId] ?? 0;
    }

    public function countByCategoryIds(array $categoryIds, bool $publishedOnly = false, bool $visibleOnly = false): array
    {
        $categoryIds = array_values(array_unique(array_filter(array_map('intval', $categoryIds))));
        if ($categoryIds === []) {
            return [];
        }

        $models = Db::table('magic_super_magic_agent_category_relations as acr')
            ->join('magic_super_magic_agent_market as market', 'market.id', '=', 'acr.relation_id')
            ->select(['acr.category_id'])
            ->selectRaw('COUNT(*) as agent_count')
            ->where('acr.relation_type', 'AGENT_MARKET')
            ->whereIn('acr.category_id', $categoryIds)
            ->whereNull('acr.deleted_at')
            ->whereNull('market.deleted_at')
            ->groupBy('acr.category_id');

        if ($publishedOnly) {
            $models->where('market.publish_status', PublishStatus::PUBLISHED->value);
        }
        if ($visibleOnly) {
            $models->where('market.is_hidden', false);
        }

        $models = $models->get();

        $counts = [];
        foreach ($models as $model) {
            $categoryId = (int) $this->getRowValue($model, 'category_id');
            $agentCount = (int) $this->getRowValue($model, 'agent_count');
            $counts[$categoryId] = $agentCount;
        }

        return $counts;
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
        // 组织编码保留资源归属上下文；市场性质只由 market_type 决定，不可依赖空值推断。
        $attributes['organization_code'] = $entity->getOrganizationCode();
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

    /** @return int[] */
    public function findIdsByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): array
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentMarketModel::query());

        return $builder->where('agent_code', $agentCode)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
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
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false);

        // 市场性质只认显式 market_type，空值统一不进入市场列表。
        $visibleOrganizationCode = $query->getVisibleOrganizationCode();
        $visibleOrganizationMarketIds = $query->getVisibleOrganizationMarketIds();
        $marketType = $query->getMarketType();
        $hasOrganizationShelf = $visibleOrganizationCode !== null
            && $visibleOrganizationCode !== ''
            && $visibleOrganizationMarketIds !== [];
        if ($marketType === AgentMarketType::ORGANIZATION && ! $hasOrganizationShelf) {
            // 组织内筛选没有命中货架时，避免生成空嵌套条件并确保分页总数为零。
            $builder->whereRaw('1 = 0');
        } else {
            $builder->where(function ($visibilityQuery) use ($visibleOrganizationCode, $visibleOrganizationMarketIds, $marketType) {
                if ($marketType === null || $marketType === AgentMarketType::MARKET) {
                    $visibilityQuery->where('market_type', AgentMarketType::MARKET->value);
                }

                if (($marketType === null || $marketType === AgentMarketType::ORGANIZATION)
                    && $visibleOrganizationCode !== null
                    && $visibleOrganizationCode !== ''
                    && $visibleOrganizationMarketIds !== []) {
                    $method = $marketType === AgentMarketType::ORGANIZATION ? 'where' : 'orWhere';
                    $visibilityQuery->{$method}(function ($organizationQuery) use ($visibleOrganizationCode, $visibleOrganizationMarketIds) {
                        $organizationQuery->where('organization_code', $visibleOrganizationCode)
                            ->whereIn('id', $visibleOrganizationMarketIds)
                            ->where('market_type', AgentMarketType::ORGANIZATION->value);
                    });
                }
            });
        }

        // 关键词搜索优先使用统一搜索字段；旧数据无该字段时回退到历史 JSON 搜索。
        if (! empty($query->getKeyword()) && ! empty($query->getLanguageCode())) {
            $keyword = mb_strtolower(trim($query->getKeyword()), 'UTF-8');
            $builder->where('search_text', 'LIKE', '%' . $keyword . '%');
        }

        // 分类筛选
        if ($query->getCategoryIds() !== []) {
            $this->applyCategoryFilter($builder, $query->getCategoryIds());
        }

        // 排序：精选优先，其次排序值，再按雇佣次数，最后按 id 兜底。
        $builder->orderBy('is_featured', 'DESC');
        $builder->orderBy('sort_order', 'DESC');
        $builder->orderBy('install_count', 'DESC');
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
        ?array $categoryIds,
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

        if (! empty($categoryIds)) {
            $this->applyCategoryFilter($builder, $categoryIds);
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

        if (array_key_exists('is_hidden', $payload)) {
            $model->is_hidden = $payload['is_hidden'];
        }

        if (array_key_exists('name_i18n', $payload)) {
            $model->name_i18n = $payload['name_i18n'];
        }

        if (array_key_exists('description_i18n', $payload)) {
            $model->description_i18n = $payload['description_i18n'];
        }

        if (array_key_exists('role_i18n', $payload)) {
            $model->role_i18n = $payload['role_i18n'];
        }

        if (array_key_exists('icon', $payload)) {
            $model->icon = $payload['icon'];
        }

        if (array_key_exists('icon_type', $payload)) {
            $model->icon_type = $payload['icon_type'];
        }

        if ($model->isDirty() === false) {
            return true;
        }

        return $model->save();
    }

    private function applyCategoryFilter($builder, array $categoryIds): void
    {
        $categoryIds = array_values(array_unique(array_filter(array_map('intval', $categoryIds))));
        if ($categoryIds === []) {
            return;
        }

        $builder->whereExists(function ($query) use ($categoryIds) {
            $query->select(Db::raw(1))
                ->from('magic_super_magic_agent_category_relations as acr')
                ->whereColumn('acr.relation_id', 'magic_super_magic_agent_market.id')
                ->where('acr.relation_type', 'AGENT_MARKET')
                ->whereIn('acr.category_id', $categoryIds)
                ->whereNull('acr.deleted_at');
        });
    }

    private function getRowValue(array|object $row, string $key): mixed
    {
        return is_array($row) ? $row[$key] : $row->{$key};
    }
}
