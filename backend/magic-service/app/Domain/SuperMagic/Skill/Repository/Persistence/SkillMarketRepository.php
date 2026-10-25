<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Repository\Persistence;

use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublisherType;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishStatus;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillQuery;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillMarketRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Persistence\Model\SkillMarketModel;
use App\Domain\SuperMagic\Skill\Repository\Persistence\Model\SkillVersionModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\SuperMagic\Utils\DateFormatUtil;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;
use Psr\SimpleCache\CacheInterface;
use RuntimeException;

/**
 * 市场 Skill 仓储实现.
 */
class SkillMarketRepository extends AbstractRepository implements SkillMarketRepositoryInterface
{
    private const OFFICIAL_BUILTIN_SKILLS_CACHE_KEY = 'super_magic:skill_market:official_builtin:entities:v2';

    private const OFFICIAL_BUILTIN_SKILLS_CACHE_TTL = 300;

    public function __construct(
        protected SkillRepositoryInterface $skillRepository,
        protected SkillMarketModel $skillMarketModel,
        protected SkillCategoryRepositoryInterface $skillCategoryRepository,
        protected CacheInterface $cache
    ) {
    }

    /**
     * 获取已发布的官方内置 Skill 实体。
     *
     * @return array<int, SkillMarketEntity>
     */
    public function getOfficialBuiltinSkillEntities(): array
    {
        $cachedRows = $this->cache->get(self::OFFICIAL_BUILTIN_SKILLS_CACHE_KEY);
        if (is_array($cachedRows)) {
            return $this->toEntities($cachedRows);
        }

        $marketTable = $this->skillMarketModel->getTable();
        $versionTable = $this->resolveSkillVersionTable();
        $models = $this->skillMarketModel::query()
            ->leftJoin($versionTable . ' as skill_versions', $marketTable . '.skill_version_id', '=', 'skill_versions.id')
            ->select($marketTable . '.*', 'skill_versions.package_name')
            ->where($marketTable . '.publisher_type', PublisherType::OFFICIAL_BUILTIN->value)
            ->where($marketTable . '.publish_status', PublishStatus::PUBLISHED->value)
            ->orderBy($marketTable . '.id')
            ->get();

        $rows = [];
        foreach ($models as $model) {
            $rows[] = $model->toArray();
        }

        $this->cache->set(
            self::OFFICIAL_BUILTIN_SKILLS_CACHE_KEY,
            $rows,
            self::OFFICIAL_BUILTIN_SKILLS_CACHE_TTL
        );

        return $this->toEntities($rows);
    }

    /**
     * 批量查询商店技能的最新版本信息（用于判断 need_upgrade）.
     */
    public function findLatestPublishedBySkillCodes(array $skillCodes): array
    {
        if (empty($skillCodes)) {
            return [];
        }

        // 查询所有符合条件的已发布版本记录
        $models = $this->skillMarketModel::query()
            ->whereIn('skill_code', $skillCodes)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->get();

        // 在 PHP 中按 skill_code 分组，取第一个遇到的记录
        $result = [];
        foreach ($models as $model) {
            $skillCode = $model->skill_code;
            if (! isset($result[$skillCode])) {
                $entity = $this->toEntity($model->toArray());
                $result[$skillCode] = $entity;
            }
        }

        return $result;
    }

    /**
     * 批量查询市场在架（已发布且未隐藏）的 Skill code.
     *
     * 与市场货架列表（queries）保持同一可见口径：publish_status = PUBLISHED 且 is_hidden = false。
     *
     * @param array<string> $skillCodes
     * @return array<string>
     */
    public function findPublishedSkillCodes(array $skillCodes): array
    {
        $skillCodes = array_values(array_unique(array_filter(
            $skillCodes,
            static fn (string $skillCode): bool => $skillCode !== ''
        )));
        if ($skillCodes === []) {
            return [];
        }

        $models = $this->skillMarketModel::query()
            ->whereIn('skill_code', $skillCodes)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false)
            ->get();

        $codes = [];
        foreach ($models as $model) {
            $codes[] = (string) $model->skill_code;
        }

        return array_values(array_unique($codes));
    }

    /**
     * 根据 skill_code 更新所有商店技能的发布状态（不限制当前状态）.
     */
    public function updateAllPublishStatusBySkillCode(string $skillCode, string $publishStatus): bool
    {
        $affected = $this->skillMarketModel::query()
            ->where('skill_code', $skillCode)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->update([
                'publish_status' => $publishStatus,
            ]);

        return $affected > 0;
    }

    /**
     * 根据 skill_code 查找商店技能.
     */
    public function findBySkillCode(string $skillCode): ?SkillMarketEntity
    {
        /** @var null|SkillMarketModel $model */
        $model = $this->skillMarketModel::query()
            ->where('skill_code', $skillCode)
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    public function findOfficialBySkillCode(string $organizationCode, string $skillCode): ?SkillMarketEntity
    {
        /** @var null|SkillMarketModel $model */
        $model = $this->skillMarketModel::query()
            ->where('organization_code', $organizationCode)
            ->where('skill_code', $skillCode)
            ->where('publisher_type', PublisherType::OFFICIAL->value)
            ->whereNull('deleted_at')
            ->first();

        return $model === null ? null : $this->toEntity($model->toArray());
    }

    public function findOfficialByPackageName(string $packageName): ?SkillMarketEntity
    {
        $marketTable = $this->skillMarketModel->getTable();
        $versionTable = $this->resolveSkillVersionTable();
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();

        /** @var null|SkillMarketModel $model */
        $model = $this->skillMarketModel::query()
            ->join($versionTable . ' as skill_versions', $marketTable . '.skill_version_id', '=', 'skill_versions.id')
            ->select($marketTable . '.*', 'skill_versions.package_name')
            ->where($marketTable . '.organization_code', $officialOrganizationCode)
            ->where('skill_versions.package_name', $packageName)
            ->where($marketTable . '.publisher_type', PublisherType::OFFICIAL->value)
            ->where($marketTable . '.publisher_id', $officialOrganizationCode)
            ->whereNull($marketTable . '.deleted_at')
            ->whereNull('skill_versions.deleted_at')
            ->first();

        return $model === null ? null : $this->toEntity($model->toArray());
    }

    public function findPublishedBySkillCode(string $skillCode): ?SkillMarketEntity
    {
        /** @var null|SkillMarketModel $model */
        $model = $this->skillMarketModel::query()
            ->where('skill_code', $skillCode)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->orderByDesc('id')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    /**
     * 保存市场技能.
     */
    public function save(SkillMarketEntity $entity): SkillMarketEntity
    {
        $attributes = $this->entityToModelAttributes($entity);

        if ($entity->getId() && $entity->getId() > 0) {
            // 更新：通过 id 查找
            /** @var null|SkillMarketModel $model */
            $model = $this->skillMarketModel::query()
                ->where('id', $entity->getId())
                ->first();
            if (! $model) {
                throw new RuntimeException('Market skill not found for update: ' . $entity->getId());
            }
            $model->fill($attributes);
            $model->save();
            return $this->toEntity($model->toArray());
        }

        // 创建
        $attributes['id'] = IdGenerator::getSnowId();
        $entity->setId($attributes['id']);
        $this->skillMarketModel::query()->create($attributes);
        return $entity;
    }

    /**
     * 查询市场技能列表（支持分页、关键词搜索、发布者类型筛选）.
     *
     * @return array{total: ?int, list: SkillMarketEntity[]}
     */
    public function queries(
        SkillQuery $query,
        Page $page
    ): array {
        $builder = $this->skillMarketModel::query()
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false);

        $keyword = $query->getKeyword() ?? '';
        $publisherType = $query->getPublisherType() ?? '';
        $codes = $query->getCodes();
        $normalizedKeyword = $keyword !== '' ? mb_strtolower(trim($keyword), 'UTF-8') : '';

        if (! empty($codes)) {
            $builder->whereIn('skill_code', array_values(array_unique($codes)));
        }

        // 关键词搜索优先使用统一搜索字段；旧数据无该字段时回退到历史 JSON 搜索。
        if ($normalizedKeyword !== '') {
            $builder->where('search_text', 'LIKE', '%' . $normalizedKeyword . '%');
        }

        // 发布者类型筛选
        if (! empty($publisherType)) {
            $builder->where('publisher_type', $publisherType);
        }

        if ($query->getIsFeatured() !== null) {
            $builder->where('is_featured', $query->getIsFeatured());
        }

        $this->applyCategoryFilter($builder, $query->getCategoryIds() ?? [], 'magic_skill_market.id');

        // 不需要 total 时跳过 count，减少一次聚合查询
        $total = null;
        if ($page->isTotal()) {
            $total = $builder->count();
        }

        $builder->orderBy('is_featured', 'DESC');
        $builder->orderBy('sort_order', 'DESC');
        $builder->orderBy('total_install_count', 'DESC');
        $builder->orderBy('id', 'DESC');

        // 分页
        $offset = ($page->getPage() - 1) * $page->getPageNum();
        $models = $builder->offset($offset)->limit($page->getPageNum())->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->toEntity($model->toArray());
        }

        return [
            'total' => $total,
            'list' => $entities,
        ];
    }

    /**
     * @return array{total: int, list: SkillMarketEntity[]}
     */
    public function queryAdminMarkets(
        ?string $publishStatus,
        ?string $organizationCode,
        ?string $name18n,
        ?string $publisherType,
        ?string $skillCode,
        ?string $packageName,
        ?string $startTime,
        ?string $endTime,
        array $categoryIds,
        string $orderBy,
        Page $page
    ): array {
        $marketTable = $this->skillMarketModel->getTable();
        $versionTable = $this->resolveSkillVersionTable();

        $builder = $this->skillMarketModel::query()
            ->leftJoin($versionTable . ' as skill_versions', $marketTable . '.skill_version_id', '=', 'skill_versions.id')
            ->select($marketTable . '.*', 'skill_versions.package_name')
            ->whereNull($marketTable . '.deleted_at');

        $publishStatus = trim((string) $publishStatus);
        if ($publishStatus !== '') {
            $builder->where($marketTable . '.publish_status', $publishStatus);
        }

        $organizationCode = trim((string) $organizationCode);
        if ($organizationCode !== '') {
            $builder->where($marketTable . '.organization_code', $organizationCode);
        }

        $publisherType = trim((string) $publisherType);
        if ($publisherType !== '') {
            $builder->where($marketTable . '.publisher_type', $publisherType);
        }

        $skillCode = trim((string) $skillCode);
        if ($skillCode !== '') {
            $builder->where($marketTable . '.skill_code', $skillCode);
        }

        $packageName = trim((string) $packageName);
        if ($packageName !== '') {
            $builder->where('skill_versions.package_name', 'LIKE', '%' . $packageName . '%');
        }

        $name18n = trim((string) $name18n);
        if ($name18n !== '') {
            $builder->where($marketTable . '.search_text', 'LIKE', '%' . $name18n . '%');
        }

        $startTime = trim((string) $startTime);
        if ($startTime !== '') {
            $builder->where($marketTable . '.created_at', '>=', DateFormatUtil::normalizeQueryRangeStart($startTime));
        }

        $endTime = trim((string) $endTime);
        if ($endTime !== '') {
            $builder->where($marketTable . '.created_at', '<=', DateFormatUtil::normalizeQueryRangeEnd($endTime));
        }

        $this->applyCategoryFilter($builder, $categoryIds, $marketTable . '.id');

        $idOrder = strtolower($orderBy) === 'asc' ? 'asc' : 'desc';
        $builder->orderBy($marketTable . '.is_featured', $idOrder);
        $builder->orderBy($marketTable . '.sort_order', $idOrder);
        $builder->orderBy($marketTable . '.total_install_count', $idOrder);
        $builder->orderBy($marketTable . '.id', $idOrder);

        $result = $this->getByPage($builder, $page);
        $list = [];
        foreach ($result['list'] as $model) {
            $list[] = $this->toEntity($model->toArray());
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }

    /**
     * 根据 ID 查找市场技能.
     */
    public function findById(int $id): ?SkillMarketEntity
    {
        /** @var null|SkillMarketModel $model */
        $model = $this->skillMarketModel::query()
            ->where('id', $id)
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    public function findByIdForVectorIndex(int $id): ?SkillMarketEntity
    {
        $marketTable = $this->skillMarketModel->getTable();
        $versionTable = $this->resolveSkillVersionTable();
        $model = $this->skillMarketModel::query()
            ->leftJoin($versionTable . ' as skill_versions', $marketTable . '.skill_version_id', '=', 'skill_versions.id')
            ->select($marketTable . '.*', 'skill_versions.package_name')
            ->where($marketTable . '.id', $id)
            ->whereNull($marketTable . '.deleted_at')
            ->first();

        return $model === null ? null : $this->toEntity($model->toArray());
    }

    /**
     * 根据 ID 查找市场技能（仅查询已发布的）.
     */
    public function findPublishedById(int $id): ?SkillMarketEntity
    {
        /** @var null|SkillMarketModel $model */
        $model = $this->skillMarketModel::query()
            ->where('id', $id)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    public function findByIds(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $models = $this->skillMarketModel::query()
            ->whereIn('id', $ids)
            ->get();

        $result = [];
        foreach ($models as $model) {
            $entity = $this->toEntity($model->toArray());
            $result[$entity->getId()] = $entity;
        }

        return $result;
    }

    public function findVisibleByIds(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $models = $this->skillMarketModel::query()
            ->whereIn('id', array_values(array_unique(array_map('intval', $ids))))
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false)
            ->whereNull('deleted_at')
            ->orderByDesc('is_featured')
            ->orderByDesc('sort_order')
            ->orderByDesc('total_install_count')
            ->orderByDesc('id')
            ->get();

        $result = [];
        foreach ($models as $model) {
            $entity = $this->toEntity($model->toArray());
            $result[(int) $entity->getId()] = $entity;
        }

        return $result;
    }

    public function findPublishedWithoutSkillFileByIdCursor(int $afterId = 0, int $limit = 100): array
    {
        $models = $this->skillMarketModel::query()
            ->select('magic_skill_market.*')
            ->join('magic_skill_versions', 'magic_skill_versions.id', '=', 'magic_skill_market.skill_version_id')
            ->where('magic_skill_market.publish_status', PublishStatus::PUBLISHED->value)
            ->whereNull('magic_skill_market.deleted_at')
            ->whereNull('magic_skill_versions.deleted_at')
            ->where('magic_skill_versions.is_current_version', 1)
            ->where(static fn ($query) => $query
                ->whereNull('magic_skill_versions.skill_file_key')
                ->orWhere('magic_skill_versions.skill_file_key', ''))
            ->where('magic_skill_market.id', '>', $afterId)
            ->orderBy('magic_skill_market.id')
            ->limit($limit)
            ->get();

        return array_map(fn (SkillMarketModel $model) => $this->toEntity($model->toArray()), $models->all());
    }

    public function findVectorIndexIds(
        array $categoryIds = [],
        array $codes = [],
        ?string $publisherType = null,
        string $afterId = '0',
        int $limit = 100,
    ): array {
        $builder = $this->skillMarketModel::query()
            ->where('id', '>', max(0, (int) $afterId))
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('is_hidden', false)
            ->whereNull('deleted_at');

        $codes = array_values(array_unique(array_filter($codes, static fn (string $code): bool => $code !== '')));
        if ($codes !== []) {
            $builder->whereIn('skill_code', $codes);
        }

        if ($publisherType !== null && trim($publisherType) !== '') {
            $builder->where('publisher_type', trim($publisherType));
        }

        $this->applyCategoryFilter($builder, array_values(array_unique(array_map('intval', $categoryIds))), 'magic_skill_market.id');

        return array_map(
            static fn ($id): int => (int) $id,
            $builder->orderBy('id')->limit(max(1, min($limit, 100)))->pluck('id')->all()
        );
    }

    /**
     * 增加商店技能的安装次数.
     */
    public function incrementInstallCount(int $id): bool
    {
        $affected = $this->skillMarketModel::query()
            ->where('id', $id)
            ->update([
                'install_count' => Db::raw('install_count + 1'),
                'total_install_count' => Db::raw('total_install_count + 1'),
            ]);

        return $affected > 0;
    }

    public function updateBaseInstallCountById(int $id, int $baseInstallCount): bool
    {
        $affected = $this->skillMarketModel::query()
            ->where('id', $id)
            ->update([
                'base_install_count' => $baseInstallCount,
                'total_install_count' => Db::raw('install_count + ' . (int) $baseInstallCount),
            ]);

        return $affected > 0 || $this->skillMarketModel::query()->where('id', $id)->exists();
    }

    /**
     * 更新市场技能排序值.
     */
    public function updateSortOrderById(int $id, int $sortOrder): bool
    {
        return $this->updateInfoById($id, ['sort_order' => $sortOrder]);
    }

    public function updateInfoById(int $id, array $payload): bool
    {
        /** @var null|SkillMarketModel $model */
        $model = $this->skillMarketModel::query()
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

        if ($model->isDirty() === false) {
            return true;
        }

        return $model->save();
    }

    /**
     * 将实体转换为模型属性.
     */
    protected function entityToModelAttributes(SkillMarketEntity $entity): array
    {
        return [
            'organization_code' => $entity->getOrganizationCode(),
            'skill_code' => $entity->getSkillCode(),
            'skill_version_id' => $entity->getSkillVersionId(),
            'name_i18n' => $entity->getNameI18n() ?? [],
            'description_i18n' => $entity->getDescriptionI18n() ?? [],
            'search_text' => $entity->getSearchText(),
            'logo' => $entity->getLogo(),
            'publisher_id' => $entity->getPublisherId(),
            'publisher_type' => $entity->getPublisherType()->value,
            'publish_status' => $entity->getPublishStatus()->value,
            'install_count' => $entity->getInstallCount(),
            'base_install_count' => $entity->getBaseInstallCount(),
            'total_install_count' => $entity->getTotalInstallCount(),
            'sort_order' => $entity->getSortOrder(),
            'is_featured' => $entity->isFeatured(),
            'is_hidden' => $entity->isHidden(),
        ];
    }

    /**
     * 将模型数据转换为实体.
     */
    protected function toEntity(array|object $data): SkillMarketEntity
    {
        $data = is_object($data) ? (array) $data : $data;

        $nameI18n = $data['name_i18n'] ?? null;
        if (is_string($nameI18n)) {
            $nameI18n = Json::decode($nameI18n);
        }

        $descriptionI18n = $data['description_i18n'] ?? null;
        if (is_string($descriptionI18n)) {
            $descriptionI18n = Json::decode($descriptionI18n);
        }

        return new SkillMarketEntity([
            'id' => $data['id'] ?? null,
            'organization_code' => $data['organization_code'] ?? '',
            'skill_code' => $data['skill_code'] ?? '',
            'skill_version_id' => $data['skill_version_id'] ?? 0,
            'package_name' => $data['package_name'] ?? '',
            'name_i18n' => $nameI18n,
            'description_i18n' => $descriptionI18n,
            'search_text' => $data['search_text'] ?? null,
            'logo' => $data['logo'] ?? null,
            'publisher_id' => $data['publisher_id'] ?? '',
            'publisher_type' => $data['publisher_type'] ?? PublisherType::USER->value,
            'publish_status' => $data['publish_status'] ?? PublishStatus::UNPUBLISHED->value,
            'install_count' => $data['install_count'] ?? 0,
            'base_install_count' => $data['base_install_count'] ?? 0,
            'total_install_count' => $data['total_install_count']
                ?? (($data['install_count'] ?? 0) + ($data['base_install_count'] ?? 0)),
            'sort_order' => $data['sort_order'] ?? null,
            'is_featured' => $data['is_featured'] ?? false,
            'is_hidden' => $data['is_hidden'] ?? false,
            'created_at' => $data['created_at'] ?? null,
            'updated_at' => $data['updated_at'] ?? null,
            'deleted_at' => $data['deleted_at'] ?? null,
        ]);
    }

    private function applyCategoryFilter($builder, array $categoryIds, string $marketIdColumn): void
    {
        if ($categoryIds === []) {
            return;
        }

        $builder->whereExists(function ($subQuery) use ($categoryIds, $marketIdColumn) {
            $subQuery->selectRaw('1')
                ->from('magic_skill_category_relations as skill_category_relations')
                ->whereColumn('skill_category_relations.relation_id', $marketIdColumn)
                ->where('skill_category_relations.relation_type', 'SKILL_MARKET')
                ->whereIn('skill_category_relations.category_id', $categoryIds)
                ->whereNull('skill_category_relations.deleted_at');
        });
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, SkillMarketEntity>
     */
    private function toEntities(array $rows): array
    {
        $entities = [];
        foreach ($rows as $row) {
            $entities[] = $this->toEntity($row);
        }

        return $entities;
    }

    private function resolveSkillVersionTable(): string
    {
        return (new SkillVersionModel())->getTable();
    }
}
