<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillVersionRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model\SkillVersionModel;
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
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    /**
     * 保存 Skill 版本.
     */
    public function save(SkillDataIsolation $dataIsolation, SkillVersionEntity $entity): SkillVersionEntity
    {
        $attributes = $this->entityToModelAttributes($entity);

        if ($entity->getId() && $entity->getId() > 0) {
            // 更新：通过 id 和 organization_code 查找，确保更新正确的记录
            $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());
            /** @var null|SkillVersionModel $model */
            $model = $builder
                ->where('id', $entity->getId())
                ->first();
            if (! $model) {
                throw new RuntimeException('Skill version not found for update: ' . $entity->getId());
            }
            $model->fill($attributes);
            $model->save();
            return $this->toEntity($model->toArray());
        }

        // 创建
        $attributes['id'] = IdGenerator::getSnowId();
        $entity->setId($attributes['id']);
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
            ->orderBy('version', 'DESC')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
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
            ->orderBy('version', 'DESC')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    /**
     * 根据 ID 查找待审核的技能版本（publish_status = UNPUBLISHED 且 review_status = UNDER_REVIEW）.
     */
    public function findPendingReviewById(SkillDataIsolation $dataIsolation, int $id): ?SkillVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());
        /** @var null|SkillVersionModel $model */
        $model = $builder
            ->where('id', $id)
            ->where('publish_status', PublishStatus::UNPUBLISHED->value)
            ->where('review_status', ReviewStatus::UNDER_REVIEW->value)
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    /**
     * 根据 code 查找所有已发布版本的 Skill 版本（publish_status = PUBLISHED 且 review_status = APPROVED）.
     */
    public function findAllPublishedByCode(SkillDataIsolation $dataIsolation, string $code): array
    {
        $builder = $this->createBuilder($dataIsolation, $this->skillVersionModel::query());
        $models = $builder
            ->where('code', $code)
            ->where('publish_status', PublishStatus::PUBLISHED->value)
            ->where('review_status', ReviewStatus::APPROVED->value)
            ->orderBy('version', 'DESC')
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
            ->orderBy('version', 'DESC')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->toEntity($model->toArray());
        }

        return $entities;
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

        return new SkillVersionEntity([
            'id' => $data['id'] ?? null,
            'code' => $data['code'] ?? '',
            'organization_code' => $data['organization_code'] ?? '',
            'creator_id' => $data['creator_id'] ?? '',
            'package_name' => $data['package_name'] ?? '',
            'package_description' => $data['package_description'] ?? null,
            'version' => $data['version'] ?? '1.0.0',
            'name_i18n' => $nameI18n,
            'description_i18n' => $descriptionI18n,
            'logo' => $data['logo'] ?? null,
            'file_key' => $data['file_key'] ?? '',
            'publish_status' => $data['publish_status'] ?? PublishStatus::UNPUBLISHED->value,
            'review_status' => $data['review_status'] ?? ReviewStatus::PENDING->value,
            'source_type' => $data['source_type'] ?? SkillSourceType::LOCAL_UPLOAD->value,
            'source_id' => $data['source_id'] ?? null,
            'source_meta' => $sourceMeta,
            'created_at' => $data['created_at'] ?? null,
            'updated_at' => $data['updated_at'] ?? null,
            'deleted_at' => $data['deleted_at'] ?? null,
        ]);
    }

    /**
     * 实体转模型属性.
     */
    protected function entityToModelAttributes(SkillVersionEntity $entity): array
    {
        return [
            'code' => $entity->getCode(),
            'organization_code' => $entity->getOrganizationCode(),
            'creator_id' => $entity->getCreatorId(),
            'package_name' => $entity->getPackageName(),
            'package_description' => $entity->getPackageDescription(),
            'version' => $entity->getVersion(),
            'name_i18n' => $entity->getNameI18n(),
            'description_i18n' => $entity->getDescriptionI18n(),
            'logo' => $entity->getLogo(),
            'file_key' => $entity->getFileKey(),
            'publish_status' => $entity->getPublishStatus()->value,
            'review_status' => $entity->getReviewStatus()?->value,
            'source_type' => $entity->getSourceType()->value,
            'source_id' => $entity->getSourceId(),
            'source_meta' => $entity->getSourceMeta(),
        ];
    }
}
