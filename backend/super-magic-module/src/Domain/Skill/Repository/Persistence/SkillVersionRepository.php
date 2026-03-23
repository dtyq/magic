<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillVersionRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model\SkillVersionModel;
use Dtyq\SuperMagic\Infrastructure\Utils\DateFormatUtil;
use Hyperf\Codec\Json;
use RuntimeException;

/**
 * Skill 版本仓储实现.
 */
class SkillVersionRepository extends AbstractRepository implements SkillVersionRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function __construct(
        protected SkillVersionModel $skillVersionModel
    ) {
    }

    /**
     * 根据 ID 查找 Skill 版本.
     */
    public function findById(SkillDataIsolation $dataIsolation, int $id): ?SkillVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());
        /** @var null|SkillVersionModel $model */
        $model = $builder
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    /**
     * 根据 ID 查找 Skill 版本（不进行组织过滤，用于查询公开的商店技能版本）.
     */
    public function findByIdWithoutOrganizationFilter(int $id): ?SkillVersionEntity
    {
        /** @var null|SkillVersionModel $model */
        $model = $this->skillVersionModel::query()
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    public function findByIdsWithoutOrganizationFilter(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $models = $this->skillVersionModel::query()
            ->whereIn('id', $ids)
            ->whereNull('deleted_at')
            ->get();

        $result = [];
        foreach ($models as $model) {
            $entity = $this->toEntity($model->toArray());
            $result[$entity->getId()] = $entity;
        }

        return $result;
    }

    /**
     * 保存 Skill 版本.
     */
    public function save(SkillDataIsolation $dataIsolation, SkillVersionEntity $entity): SkillVersionEntity
    {
        $attributes = $this->entityToModelAttributes($entity);

        if ($entity->getId() && $entity->getId() > 0) {
            $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());
            /** @var null|SkillVersionModel $model */
            $model = $builder
                ->where('id', $entity->getId())
                ->whereNull('deleted_at')
                ->first();
            if (! $model) {
                throw new RuntimeException('Skill version not found for update: ' . $entity->getId());
            }
            $model->fill($attributes);
            $model->save();
            return $this->toEntity($model->toArray());
        }

        $attributes['id'] = IdGenerator::getSnowId();
        $attributes['created_at'] = date('Y-m-d H:i:s');
        $attributes['updated_at'] = date('Y-m-d H:i:s');
        $entity->setId($attributes['id']);
        $entity->setCreatedAt($attributes['created_at']);
        $entity->setUpdatedAt($attributes['updated_at']);
        $this->skillVersionModel::query()->create($attributes);
        return $entity;
    }

    /**
     * 根据 code 查找最新版本的 Skill 版本.
     */
    public function findLatestByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());
        /** @var null|SkillVersionModel $model */
        $model = $builder
            ->where('code', $code)
            ->whereNull('deleted_at')
            ->orderBy('created_at', 'DESC')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    public function findCurrentOrLatestByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());
        /** @var null|SkillVersionModel $model */
        $model = $builder
            ->where('code', $code)
            ->whereNull('deleted_at')
            ->where('is_current_version', 1)
            ->orderBy('created_at', 'DESC')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    /**
     * @return array<string, SkillVersionEntity>
     */
    public function findCurrentOrLatestByCodes(SkillDataIsolation $dataIsolation, array $codes): array
    {
        if ($codes === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());
        $models = $builder
            ->whereIn('code', $codes)
            ->where('is_current_version', 1)
            ->whereNull('deleted_at')
            ->orderBy('created_at', 'DESC')
            ->get();

        $result = [];
        /** @var SkillVersionModel $model */
        foreach ($models as $model) {
            $code = (string) $model->code;
            if (isset($result[$code])) {
                continue;
            }
            $result[$code] = $this->toEntity($model->toArray());
        }

        return $result;
    }

    /**
     * @return array<string, SkillVersionEntity>
     */
    public function findCurrentByCodesWithoutOrganizationFilter(array $codes): array
    {
        $codes = array_values(array_unique(array_filter($codes)));
        if ($codes === []) {
            return [];
        }

        $models = $this->skillVersionModel::query()
            ->whereIn('code', $codes)
            ->where('is_current_version', 1)
            ->whereNull('deleted_at')
            ->orderBy('created_at', 'DESC')
            ->get();

        $result = [];
        /** @var SkillVersionModel $model */
        foreach ($models as $model) {
            $code = (string) $model->code;
            if (isset($result[$code])) {
                continue;
            }
            $result[$code] = $this->toEntity($model->toArray());
        }

        return $result;
    }

    /**
     * @return array<string, SkillVersionEntity>
     */
    public function findCurrentPublishedByCodes(SkillDataIsolation $dataIsolation, array $codes): array
    {
        if ($codes === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());
        $models = $builder
            ->whereIn('code', $codes)
            ->where('is_current_version', 1)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('review_status', ReviewStatus::APPROVED->value)
            ->whereNull('deleted_at')
            ->orderBy('published_at', 'DESC')
            ->orderBy('created_at', 'DESC')
            ->get();

        $result = [];
        /** @var SkillVersionModel $model */
        foreach ($models as $model) {
            $code = (string) $model->code;
            if (isset($result[$code])) {
                continue;
            }
            $result[$code] = $this->toEntity($model->toArray());
        }

        return $result;
    }

    public function existsByCodeAndVersion(SkillDataIsolation $dataIsolation, string $code, string $version): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());

        return $builder
            ->where('code', $code)
            ->where('version', $version)
            ->whereNull('deleted_at')
            ->exists();
    }

    /**
     * 根据 code 查找最新已发布版本的 Skill 版本（publish_status = PUBLISHED 且 review_status = APPROVED）.
     */
    public function findLatestPublishedByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());
        /** @var null|SkillVersionModel $model */
        $model = $builder
            ->where('code', $code)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('review_status', ReviewStatus::APPROVED->value)
            ->whereNull('deleted_at')
            ->orderBy('is_current_version', 'DESC')
            ->orderBy('published_at', 'DESC')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    /**
     * 根据 ID 查找待审核的技能版本（publish_status = UNPUBLISHED 且 review_status = UNDER_REVIEW）.
     */
    public function findPendingReviewById(int $id): ?SkillVersionEntity
    {
        $builder = $this->skillVersionModel::query();
        /** @var null|SkillVersionModel $model */
        $model = $builder
            ->where('id', $id)
            ->where('review_status', ReviewStatus::UNDER_REVIEW->value)
            ->whereNull('deleted_at')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    /**
     * 根据 code 查找所有已发布版本的 Skill 版本.
     */
    public function findAllPublishedByCode(SkillDataIsolation $dataIsolation, string $code): array
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());
        $models = $builder
            ->where('code', $code)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('review_status', ReviewStatus::APPROVED->value)
            ->whereNull('deleted_at')
            ->orderBy('published_at', 'DESC')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->toEntity($model->toArray());
        }

        return $entities;
    }

    /**
     * 根据 code 查找所有版本的 Skill 版本（不限制状态）.
     */
    public function findAllByCode(SkillDataIsolation $dataIsolation, string $code): array
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());
        $models = $builder
            ->where('code', $code)
            ->whereNull('deleted_at')
            ->orderBy('created_at', 'DESC')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->toEntity($model->toArray());
        }

        return $entities;
    }

    public function invalidateAwaitingReviewVersionsByCode(SkillDataIsolation $dataIsolation, string $code): int
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());

        return (int) $builder
            ->where('code', $code)
            ->whereNull('deleted_at')
            ->whereIn('review_status', [
                ReviewStatus::PENDING->value,
                ReviewStatus::UNDER_REVIEW->value,
            ])
            ->update([
                'review_status' => ReviewStatus::INVALIDATED->value,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    public function offlinePublishedVersionsByCode(SkillDataIsolation $dataIsolation, string $code): int
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());

        return (int) $builder
            ->where('code', $code)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('review_status', ReviewStatus::APPROVED->value)
            ->whereNull('deleted_at')
            ->update([
                'publish_status' => PublishStatus::OFFLINE->value,
            ]);
    }

    public function clearCurrentVersion(SkillDataIsolation $dataIsolation, string $code): int
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());

        return $builder
            ->where('code', $code)
            ->where('is_current_version', 1)
            ->whereNull('deleted_at')
            ->update([
                'is_current_version' => 0,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    public function deleteByCode(SkillDataIsolation $dataIsolation, string $code): int
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());

        return $builder
            ->where('code', $code)
            ->whereNull('deleted_at')
            ->delete();
    }

    public function countByCode(SkillDataIsolation $dataIsolation, string $code): int
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query())
            ->where('code', $code)
            ->whereNull('deleted_at');

        return (int) $builder->count();
    }

    public function queriesByCode(
        SkillDataIsolation $dataIsolation,
        string $code,
        ?PublishTargetType $publishTargetType = null,
        ?ReviewStatus $reviewStatus = null,
        Page $page = new Page()
    ): array {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query())
            ->where('code', $code)
            ->whereNull('deleted_at');

        if ($publishTargetType !== null) {
            $builder->where('publish_target_type', $publishTargetType->value);
        }

        if ($reviewStatus !== null) {
            $builder->where('review_status', $reviewStatus->value);
        }

        $builder->orderBy('created_at', 'DESC');

        $result = $this->getByPage($builder, $page);
        $list = [];
        foreach ($result['list'] as $model) {
            $list[] = $this->toEntity($model->toArray());
        }
        $result['list'] = $list;

        return $result;
    }

    public function queriesCurrentPublishedByCodes(
        SkillDataIsolation $dataIsolation,
        array $codes,
        ?string $keyword,
        string $languageCode,
        Page $page
    ): array {
        if ($codes === []) {
            return [
                'total' => 0,
                'list' => [],
            ];
        }

        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query())
            ->whereIn('code', $codes)
            ->where('is_current_version', 1)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('review_status', ReviewStatus::APPROVED->value)
            ->whereNull('deleted_at');

        $keyword = trim((string) $keyword);
        if ($keyword !== '') {
            $builder->where('search_text', 'LIKE', '%' . mb_strtolower($keyword, 'UTF-8') . '%');
        }

        $builder->orderBy('published_at', 'DESC')->orderBy('created_at', 'DESC');

        $result = $this->getByPage($builder, $page);
        $list = [];
        foreach ($result['list'] as $model) {
            $list[] = $this->toEntity($model->toArray());
        }
        $result['list'] = $list;

        return $result;
    }

    public function queryVersions(
        SkillDataIsolation $dataIsolation,
        ?string $reviewStatus,
        ?string $publishStatus,
        ?string $publishTargetType,
        ?string $sourceType,
        ?string $version,
        ?string $packageName,
        ?string $skillName,
        ?string $organizationCode,
        ?string $startTime,
        ?string $endTime,
        string $orderBy,
        Page $page
    ): array {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query())
            ->whereNull('deleted_at');

        $organizationCodeTrimmed = trim((string) $organizationCode);
        if ($organizationCodeTrimmed !== '') {
            $builder->where('organization_code', $organizationCodeTrimmed);
        }

        if ($reviewStatus !== null && $reviewStatus !== '') {
            $builder->where('review_status', $reviewStatus);
        }

        if ($publishStatus !== null && $publishStatus !== '') {
            $builder->where('publish_status', $publishStatus);
        }

        if ($publishTargetType !== null && $publishTargetType !== '') {
            $builder->where('publish_target_type', $publishTargetType);
        }

        if ($sourceType !== null && $sourceType !== '') {
            $builder->where('source_type', $sourceType);
        }

        if ($version !== null && $version !== '') {
            $builder->where('version', $version);
        }

        $skillNameTrimmed = trim((string) $skillName);
        if ($skillNameTrimmed !== '') {
            $builder->where('search_text', 'LIKE', '%' . mb_strtolower($skillNameTrimmed, 'UTF-8') . '%');
        }

        if ($startTime !== null && $startTime !== '') {
            $builder->where('created_at', '>=', DateFormatUtil::normalizeQueryRangeStart($startTime));
        }

        if ($endTime !== null && $endTime !== '') {
            $builder->where('created_at', '<=', DateFormatUtil::normalizeQueryRangeEnd($endTime));
        }

        $builder->orderBy('created_at', strtolower($orderBy) === 'desc' ? 'desc' : 'asc');

        $result = $this->getByPage($builder, $page);
        $list = [];
        foreach ($result['list'] as $model) {
            $list[] = $this->toEntity($model->toArray());
        }
        $result['list'] = $list;

        return $result;
    }

    /**
     * 将模型数据转换为实体.
     */
    protected function toEntity(array|object $data): SkillVersionEntity
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

        $sourceMeta = $data['source_meta'] ?? null;
        if (is_string($sourceMeta)) {
            $sourceMeta = Json::decode($sourceMeta);
        }

        $publishTargetValue = $data['publish_target_value'] ?? null;
        if (is_string($publishTargetValue)) {
            $publishTargetValue = Json::decode($publishTargetValue);
        }

        $versionDescriptionI18n = $data['version_description_i18n'] ?? null;
        if (is_string($versionDescriptionI18n)) {
            $versionDescriptionI18n = Json::decode($versionDescriptionI18n);
        }

        $entity = new SkillVersionEntity([
            'id' => $data['id'] ?? null,
            'code' => $data['code'] ?? '',
            'organization_code' => $data['organization_code'] ?? '',
            'creator_id' => $data['creator_id'] ?? '',
            'package_name' => $data['package_name'] ?? '',
            'package_description' => $data['package_description'] ?? null,
            'version' => $data['version'] ?? '1.0.0',
            'name_i18n' => $nameI18n,
            'description_i18n' => $descriptionI18n,
            'search_text' => $data['search_text'] ?? null,
            'logo' => $data['logo'] ?? null,
            'file_key' => $data['file_key'] ?? '',
            'publish_status' => $data['publish_status'] ?? PublishStatus::UNPUBLISHED->value,
            'review_status' => $data['review_status'] ?? ReviewStatus::PENDING->value,
            'publish_target_type' => $data['publish_target_type'] ?? PublishTargetType::MARKET->value,
            'publish_target_value' => $publishTargetValue,
            'version_description_i18n' => $versionDescriptionI18n,
            'publisher_user_id' => $data['publisher_user_id'] ?? null,
            'source_type' => $data['source_type'] ?? SkillSourceType::LOCAL_UPLOAD->value,
            'source_id' => $data['source_id'] ?? null,
            'source_meta' => $sourceMeta,
            'project_id' => isset($data['project_id']) ? (int) $data['project_id'] : null,
        ]);

        $entity->setPublishedAt(isset($data['published_at']) ? (is_string($data['published_at']) ? $data['published_at'] : $data['published_at']?->format('Y-m-d H:i:s')) : null);
        $entity->setIsCurrentVersion($data['is_current_version'] ?? false);

        if (isset($data['created_at'])) {
            $entity->setCreatedAt(is_string($data['created_at']) ? $data['created_at'] : $data['created_at']->format('Y-m-d H:i:s'));
        }
        if (isset($data['updated_at'])) {
            $entity->setUpdatedAt(is_string($data['updated_at']) ? $data['updated_at'] : $data['updated_at']->format('Y-m-d H:i:s'));
        }
        if (isset($data['deleted_at'])) {
            $entity->setDeletedAt(is_string($data['deleted_at']) ? $data['deleted_at'] : ($data['deleted_at'] ? $data['deleted_at']->format('Y-m-d H:i:s') : null));
        }

        return $entity;
    }

    /**
     * 实体转模型属性.
     */
    protected function entityToModelAttributes(SkillVersionEntity $entity): array
    {
        $attributes = [
            'code' => $entity->getCode(),
            'organization_code' => $entity->getOrganizationCode(),
            'creator_id' => $entity->getCreatorId(),
            'package_name' => $entity->getPackageName(),
            'package_description' => $entity->getPackageDescription(),
            'version' => $entity->getVersion(),
            'name_i18n' => $entity->getNameI18n(),
            'description_i18n' => $entity->getDescriptionI18n(),
            'search_text' => $entity->getSearchText(),
            'logo' => $entity->getLogo(),
            'file_key' => $entity->getFileKey(),
            'publish_status' => $entity->getPublishStatus()->value,
            'review_status' => $entity->getReviewStatus()?->value,
            'publish_target_type' => $entity->getPublishTargetType()->value,
            'publish_target_value' => $entity->getPublishTargetValue()?->toArray(),
            'version_description_i18n' => $entity->getVersionDescriptionI18n(),
            'publisher_user_id' => $entity->getPublisherUserId(),
            'published_at' => $entity->getPublishedAt(),
            'is_current_version' => $entity->isCurrentVersion() ? 1 : 0,
            'source_type' => $entity->getSourceType()->value,
            'source_id' => $entity->getSourceId(),
            'source_meta' => $entity->getSourceMeta(),
            'project_id' => $entity->getProjectId(),
        ];

        if ($entity->getId() && $entity->getId() > 0) {
            $attributes['updated_at'] = date('Y-m-d H:i:s');
        }

        return $attributes;
    }
}
