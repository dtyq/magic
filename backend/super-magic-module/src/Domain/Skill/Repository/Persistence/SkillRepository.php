<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model\SkillModel;
use Hyperf\Codec\Json;
use RuntimeException;

/**
 * Skill 仓储实现.
 */
class SkillRepository extends AbstractRepository implements SkillRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function __construct(
        protected SkillModel $skillModel
    ) {
    }

    /**
     * 根据 code 查找 Skill.
     */
    public function findByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());
        /** @var null|SkillModel $model */
        $model = $builder
            ->where('code', $code)
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    /**
     * 根据 code 列表批量查询技能.
     *
     * @return array<string, SkillEntity> 技能实体数组，key 为 code
     */
    public function findByCodes(SkillDataIsolation $dataIsolation, array $codes): array
    {
        if (empty($codes)) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());
        $builder->whereIn('code', $codes);

        $models = $builder->get();

        $result = [];
        foreach ($models as $model) {
            $entity = $this->toEntity($model->toArray());
            $code = $entity->getCode();
            if ($code) {
                $result[$code] = $entity;
            }
        }

        return $result;
    }

    /**
     * 保存 Skill.
     */
    public function save(SkillDataIsolation $dataIsolation, SkillEntity $entity): SkillEntity
    {
        $attributes = $this->entityToModelAttributes($entity);

        if ($entity->getId() && $entity->getId() > 0) {
            // 更新：通过 id 和 organization_code 查找，确保更新正确的记录
            $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());
            /** @var null|SkillModel $model */
            $model = $builder
                ->where('id', $entity->getId())
                ->first();
            if (! $model) {
                throw new RuntimeException('Skill not found for update: ' . $entity->getId());
            }
            $model->fill($attributes);
            $model->save();
            return $this->toEntity($model->toArray());
        }

        // 创建
        $attributes['id'] = IdGenerator::getSnowId();
        $entity->setId($attributes['id']);
        $this->skillModel::query()->create($attributes);
        return $entity;
    }

    /**
     * 根据 package_name 和 creator_id 查找用户已存在的技能（非store来源）.
     */
    public function findByPackageNameAndCreator(SkillDataIsolation $dataIsolation, string $packageName): ?SkillEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());
        /** @var null|SkillModel $model */
        $model = $builder
            ->where('package_name', $packageName)
            ->where('creator_id', $dataIsolation->getCurrentUserId())
            ->where('source_type', '!=', SkillSourceType::MARKET->value)
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    /**
     * 根据 package_name 查找用户组织下已存在的技能（所有来源类型）.
     */
    public function findByPackageName(SkillDataIsolation $dataIsolation, string $packageName): ?SkillEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());
        /** @var null|SkillModel $model */
        $model = $builder
            ->where('package_name', $packageName)
            ->where('creator_id', $dataIsolation->getCurrentUserId())
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    /**
     * 查询用户技能列表（支持分页、关键词搜索、来源类型筛选）.
     *
     * @return array{total: int, list: SkillEntity[]}
     */
    public function queries(
        SkillDataIsolation $dataIsolation,
        SkillQuery $query,
        Page $page
    ): array {
        $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());

        $builder->where('creator_id', $dataIsolation->getCurrentUserId());

        $keyword = trim((string) ($query->getKeyword() ?? ''));
        $sourceType = $query->getSourceType() ?? '';

        if ($keyword !== '') {
            $builder->where('search_text', 'LIKE', '%' . mb_strtolower($keyword, 'UTF-8') . '%');
        }

        // 来源类型筛选
        if (! empty($sourceType)) {
            $builder->where('source_type', $sourceType);
        }

        // 先查询总数
        $total = $builder->count();

        // 排序：pinned_at DESC, updated_at DESC
        // 使用 orderByRaw 处理 NULL 值，将 NULL 排在最后
        $builder->orderByRaw('CASE WHEN pinned_at IS NULL THEN 1 ELSE 0 END')
            ->orderBy('pinned_at', 'DESC')
            ->orderBy('updated_at', 'DESC');

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
     * Query visible skills by skill codes.
     *
     * @return array{total: int, list: SkillEntity[]}
     */
    public function queriesByCodes(
        SkillDataIsolation $dataIsolation,
        array $codes,
        SkillQuery $query,
        Page $page
    ): array {
        if ($codes === []) {
            return [
                'total' => 0,
                'list' => [],
            ];
        }

        $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());
        $builder->whereIn('code', $codes);

        $keyword = trim((string) ($query->getKeyword() ?? ''));
        $sourceType = $query->getSourceType() ?? '';

        if ($keyword !== '') {
            $builder->where('search_text', 'LIKE', '%' . mb_strtolower($keyword, 'UTF-8') . '%');
        }

        if ($sourceType !== '') {
            $builder->where('source_type', $sourceType);
        }

        $total = $builder->count();

        $builder->orderByRaw('CASE WHEN pinned_at IS NULL THEN 1 ELSE 0 END')
            ->orderBy('pinned_at', 'DESC')
            ->orderBy('updated_at', 'DESC');

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

    public function queriesSharedByCodes(
        SkillDataIsolation $dataIsolation,
        array $codes,
        SkillQuery $query,
        Page $page
    ): array {
        if ($codes === []) {
            return [
                'total' => 0,
                'list' => [],
            ];
        }

        $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());
        $builder->whereIn('code', $codes)
            ->where('creator_id', '!=', $dataIsolation->getCurrentUserId());

        $keyword = trim((string) ($query->getKeyword() ?? ''));
        $sourceType = $query->getSourceType() ?? '';

        if ($keyword !== '') {
            $builder->where('search_text', 'LIKE', '%' . mb_strtolower($keyword, 'UTF-8') . '%');
        }

        if ($sourceType !== '') {
            $builder->where('source_type', $sourceType);
        }

        $total = $builder->count();

        $builder->orderByRaw('CASE WHEN pinned_at IS NULL THEN 1 ELSE 0 END')
            ->orderBy('pinned_at', 'DESC')
            ->orderBy('updated_at', 'DESC');

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
     * 查询用户技能总数（用于分页）.
     */
    public function countList(
        SkillDataIsolation $dataIsolation,
        string $keyword,
        string $languageCode,
        string $sourceType
    ): int {
        $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());

        $keyword = trim((string) $keyword);
        if ($keyword !== '') {
            $builder->where('search_text', 'LIKE', '%' . mb_strtolower($keyword, 'UTF-8') . '%');
        }

        // 来源类型筛选
        if (! empty($sourceType)) {
            $builder->where('source_type', $sourceType);
        }

        return $builder->count();
    }

    /**
     * 根据 version_code 列表查询用户已添加的技能（用于判断 is_added 和 need_upgrade）.
     *
     * @return array<string, SkillEntity> 技能实体数组，key 为 version_code
     */
    public function findByVersionCodes(SkillDataIsolation $dataIsolation, array $versionCodes): array
    {
        if (empty($versionCodes)) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());
        $builder->where('creator_id', $dataIsolation->getCurrentUserId())
            ->whereIn('version_code', $versionCodes);

        $models = $builder->get();

        $result = [];
        foreach ($models as $model) {
            $entity = $this->toEntity($model->toArray());
            $versionCode = $entity->getVersionCode();
            if ($versionCode) {
                $result[$versionCode] = $entity;
            }
        }

        return $result;
    }

    /**
     * 根据 code 删除 Skill（软删除）.
     */
    public function deleteByCode(SkillDataIsolation $dataIsolation, string $code): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());
        /** @var null|SkillModel $model */
        $model = $builder
            ->where('code', $code)
            ->first();

        if (! $model) {
            return false;
        }

        return $model->delete() !== false;
    }

    /**
     * 根据 ID 列表批量查询技能详情.
     *
     * @return array<int, SkillEntity> 技能实体数组，key 为 skill_id
     */
    public function findByIds(SkillDataIsolation $dataIsolation, array $skillIds): array
    {
        if (empty($skillIds)) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());
        $models = $builder->whereIn('id', $skillIds)->get();

        $result = [];
        foreach ($models as $model) {
            $entity = $this->toEntity($model->toArray());
            $result[$entity->getId()] = $entity;
        }

        return $result;
    }

    /**
     * 根据 ID 列表批量查询技能详情.
     *
     * @return array<int, SkillEntity> 技能实体数组，key 为 skill_id
     */
    public function findUserSkillsByIds(SkillDataIsolation $dataIsolation, array $skillIds): array
    {
        if (empty($skillIds)) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, $this->skillModel::query());
        $models = $builder->whereIn('id', $skillIds)->get();

        $result = [];
        foreach ($models as $model) {
            $entity = $this->toEntity($model->toArray());
            $result[$entity->getId()] = $entity;
        }

        return $result;
    }

    /**
     * 将模型数据转换为实体.
     */
    protected function toEntity(array|object $data): SkillEntity
    {
        $data = is_object($data) ? (array) $data : $data;

        $nameI18n = $data['name_i18n'] ?? [];
        if (is_string($nameI18n)) {
            $nameI18n = Json::decode($nameI18n);
        }

        $descriptionI18n = $data['description_i18n'] ?? null;
        if (is_string($descriptionI18n)) {
            $descriptionI18n = Json::decode($descriptionI18n);
        }

        $sourceI18n = $data['source_i18n'] ?? null;
        if (is_string($sourceI18n)) {
            $sourceI18n = Json::decode($sourceI18n);
        }

        $sourceMeta = $data['source_meta'] ?? null;
        if (is_string($sourceMeta)) {
            $sourceMeta = Json::decode($sourceMeta);
        }

        return new SkillEntity([
            'id' => $data['id'] ?? null,
            'organization_code' => $data['organization_code'] ?? '',
            'code' => $data['code'] ?? '',
            'creator_id' => $data['creator_id'] ?? '',
            'package_name' => $data['package_name'] ?? '',
            'package_description' => $data['package_description'] ?? null,
            'name_i18n' => $nameI18n,
            'description_i18n' => $descriptionI18n,
            'source_i18n' => $sourceI18n,
            'search_text' => $data['search_text'] ?? null,
            'logo' => $data['logo'] ?? null,
            'file_key' => $data['file_key'] ?? '',
            'source_type' => ! empty($data['source_type']) ? SkillSourceType::from($data['source_type']) : SkillSourceType::LOCAL_UPLOAD,
            'source_id' => $data['source_id'] ?? null,
            'source_meta' => $sourceMeta,
            'version_id' => $data['version_id'] ?? null,
            'version_code' => $data['version_code'] ?? null,
            'is_enabled' => $data['is_enabled'] ?? true,
            'pinned_at' => $data['pinned_at'] ?? null,
            'project_id' => isset($data['project_id']) ? (int) $data['project_id'] : null,
            'latest_published_at' => isset($data['latest_published_at']) ? (is_string($data['latest_published_at']) ? $data['latest_published_at'] : $data['latest_published_at']?->format('Y-m-d H:i:s')) : null,
            'created_at' => $data['created_at'] ?? null,
            'updated_at' => $data['updated_at'] ?? null,
            'deleted_at' => $data['deleted_at'] ?? null,
        ]);
    }

    /**
     * 实体转模型属性.
     */
    protected function entityToModelAttributes(SkillEntity $entity): array
    {
        return [
            'organization_code' => $entity->getOrganizationCode(),
            'code' => $entity->getCode(),
            'creator_id' => $entity->getCreatorId(),
            'package_name' => $entity->getPackageName(),
            'package_description' => $entity->getPackageDescription(),
            'name_i18n' => $entity->getNameI18n(),
            'description_i18n' => $entity->getDescriptionI18n(),
            'source_i18n' => $entity->getSourceI18n(),
            'search_text' => $entity->getSearchText(),
            'logo' => $entity->getLogo(),
            'file_key' => $entity->getFileKey(),
            'source_type' => $entity->getSourceType()->value,
            'source_id' => $entity->getSourceId(),
            'source_meta' => $entity->getSourceMeta(),
            'version_id' => $entity->getVersionId(),
            'version_code' => $entity->getVersionCode(),
            'is_enabled' => $entity->getIsEnabled() ? 1 : 0,
            'pinned_at' => $entity->getPinnedAt(),
            'project_id' => $entity->getProjectId(),
            'latest_published_at' => $entity->getLatestPublishedAt(),
        ];
    }
}
