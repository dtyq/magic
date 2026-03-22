<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillCategoryRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillMarketRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model\SkillMarketModel;
use Dtyq\SuperMagic\Infrastructure\Utils\DateFormatUtil;
use Hyperf\Codec\Json;
use RuntimeException;

/**
 * 市场 Skill 仓储实现.
 */
class SkillMarketRepository extends AbstractRepository implements SkillMarketRepositoryInterface
{
    public function __construct(
        protected SkillRepositoryInterface $skillRepository,
        protected SkillMarketModel $skillMarketModel,
        protected SkillCategoryRepositoryInterface $skillCategoryRepository
    ) {
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
     * @return array{total: int, list: SkillMarketEntity[]}
     */
    public function queries(
        SkillQuery $query,
        Page $page
    ): array {
        $builder = $this->skillMarketModel::query()
            ->where('publish_status', PublishStatus::PUBLISHED->value);

        $keyword = $query->getKeyword() ?? '';
        $languageCode = $query->getLanguageCode() ?? 'en_US';
        $publisherType = $query->getPublisherType() ?? '';
        $codes = $query->getCodes();

        if (! empty($codes)) {
            $builder->whereIn('skill_code', array_values(array_unique($codes)));
        }

        // 关键词搜索：在 name_i18n 和 description_i18n JSON 字段中搜索，
        // 各字段额外支持 default 兜底搜索
        if (! empty($keyword)) {
            $builder->where(function ($q) use ($keyword, $languageCode) {
                $q->whereRaw(
                    "JSON_EXTRACT(name_i18n, CONCAT('$.', ?)) LIKE ?",
                    [$languageCode, '%' . $keyword . '%']
                )->orWhereRaw(
                    "JSON_EXTRACT(name_i18n, '$.default') LIKE ?",
                    ['%' . $keyword . '%']
                )->orWhereRaw(
                    "JSON_EXTRACT(description_i18n, CONCAT('$.', ?)) LIKE ?",
                    [$languageCode, '%' . $keyword . '%']
                )->orWhereRaw(
                    "JSON_EXTRACT(description_i18n, '$.default') LIKE ?",
                    ['%' . $keyword . '%']
                );
            });
        }

        // 发布者类型筛选
        if (! empty($publisherType)) {
            $builder->where('publisher_type', $publisherType);
        }

        // 先查询总数
        $total = $builder->count();

        // 排序：sort_order 非空优先，数值越大越靠前；为空时回落按创建时间
        $builder->orderByRaw('sort_order IS NULL ASC');
        $builder->orderBy('sort_order', 'DESC');
        $builder->orderBy('created_at', 'DESC');

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
        ?string $startTime,
        ?string $endTime,
        string $orderBy,
        Page $page
    ): array {
        $builder = $this->skillMarketModel::query()
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

        $skillCode = trim((string) $skillCode);
        if ($skillCode !== '') {
            $builder->where('skill_code', $skillCode);
        }

        $name18n = trim((string) $name18n);
        if ($name18n !== '') {
            $like = '%' . $name18n . '%';
            $localeKeys = LanguageEnum::getAllLanguageCodes();
            $builder->where(function ($q) use ($like, $localeKeys) {
                $first = true;
                foreach ($localeKeys as $localeKey) {
                    $expression = "JSON_EXTRACT(name_i18n, CONCAT('$.', ?)) LIKE ?";
                    $bindings = [$localeKey, $like];
                    if ($first) {
                        $q->whereRaw($expression, $bindings);
                        $first = false;
                    } else {
                        $q->orWhereRaw($expression, $bindings);
                    }
                }
            });
        }

        $startTime = trim((string) $startTime);
        if ($startTime !== '') {
            $builder->where('created_at', '>=', DateFormatUtil::normalizeQueryRangeStart($startTime));
        }

        $endTime = trim((string) $endTime);
        if ($endTime !== '') {
            $builder->where('created_at', '<=', DateFormatUtil::normalizeQueryRangeEnd($endTime));
        }

        $createdAtOrder = strtolower($orderBy) === 'asc' ? 'asc' : 'desc';
        $builder->orderByRaw('sort_order IS NULL ASC');
        $builder->orderBy('sort_order', 'DESC');
        $builder->orderBy('created_at', $createdAtOrder);

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

    /**
     * 增加商店技能的安装次数.
     */
    public function incrementInstallCount(int $id): bool
    {
        $affected = $this->skillMarketModel::query()
            ->where('id', $id)
            ->increment('install_count');

        return $affected > 0;
    }

    /**
     * 更新市场技能排序值.
     */
    public function updateSortOrderById(int $id, int $sortOrder): bool
    {
        /** @var null|SkillMarketModel $model */
        $model = $this->skillMarketModel::query()
            ->where('id', $id)
            ->first();

        if (! $model) {
            return false;
        }

        $model->sort_order = $sortOrder;
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
            'logo' => $entity->getLogo(),
            'publisher_id' => $entity->getPublisherId(),
            'publisher_type' => $entity->getPublisherType()->value,
            'category_id' => $entity->getCategoryId(),
            'publish_status' => $entity->getPublishStatus()->value,
            'install_count' => $entity->getInstallCount(),
            'sort_order' => $entity->getSortOrder(),
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
            'name_i18n' => $nameI18n,
            'description_i18n' => $descriptionI18n,
            'logo' => $data['logo'] ?? null,
            'publisher_id' => $data['publisher_id'] ?? '',
            'publisher_type' => $data['publisher_type'] ?? PublisherType::USER->value,
            'category_id' => $data['category_id'] ?? null,
            'publish_status' => $data['publish_status'] ?? PublishStatus::UNPUBLISHED->value,
            'install_count' => $data['install_count'] ?? 0,
            'sort_order' => $data['sort_order'] ?? null,
            'created_at' => $data['created_at'] ?? null,
            'updated_at' => $data['updated_at'] ?? null,
            'deleted_at' => $data['deleted_at'] ?? null,
        ]);
    }
}
