<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Repository\Persistence;

use App\Domain\SuperMagic\Skill\Entity\SkillCategoryEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillCategoryQuery;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Persistence\Model\SkillCategoryModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

/**
 * Skill 分类仓储实现.
 */
class SkillCategoryRepository extends AbstractRepository implements SkillCategoryRepositoryInterface
{
    public function __construct(
        protected SkillCategoryModel $skillCategoryModel
    ) {
    }

    public function findById(int $id): ?SkillCategoryEntity
    {
        $model = $this->skillCategoryModel::query()->find($id);
        return $model === null ? null : new SkillCategoryEntity($model->toArray());
    }

    public function findByIds(array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if ($ids === []) {
            return [];
        }
        return $this->skillCategoryModel::query()->whereIn('id', $ids)->get()
            ->map(static fn (SkillCategoryModel $model) => new SkillCategoryEntity($model->toArray()))->all();
    }

    public function findByQuery(SkillCategoryQuery $query): array
    {
        $builder = $this->skillCategoryModel::query();
        if (($keyword = trim((string) $query->getKeyword())) !== '') {
            $builder->where('name_i18n', 'LIKE', '%' . $keyword . '%');
        }
        if ($query->getStatus() !== null) {
            $builder->where('status', $query->getStatus());
        }
        return $builder->orderBy('parent_id')->orderByDesc('sort_order')->orderBy('created_at')->get()
            ->map(static fn (SkillCategoryModel $model) => new SkillCategoryEntity($model->toArray()))->all();
    }

    public function findAll(): array
    {
        return $this->findByQuery(new SkillCategoryQuery());
    }

    public function findChildren(int $parentId): array
    {
        return $this->skillCategoryModel::query()->where('parent_id', $parentId)->get()
            ->map(static fn ($model) => new SkillCategoryEntity($model->toArray()))->all();
    }

    public function findSelfAndDescendantIds(array $categoryIds): array
    {
        $pending = array_values(array_unique(array_filter(array_map('intval', $categoryIds))));
        $result = $pending;
        while ($pending !== []) {
            $children = $this->skillCategoryModel::query()->whereIn('parent_id', $pending)->pluck('id')->map(static fn ($id) => (int) $id)->all();
            $children = array_values(array_diff($children, $result));
            $result = array_merge($result, $children);
            $pending = $children;
        }
        return $result;
    }

    public function save(SkillCategoryEntity $entity): SkillCategoryEntity
    {
        if ($entity->getId() === null) {
            $entity->setId(IdGenerator::getSnowId());
        }
        $model = $this->skillCategoryModel::withTrashed()->find($entity->getId()) ?? new SkillCategoryModel();
        $model->fill($entity->toArray());
        $model->save();
        return new SkillCategoryEntity($model->toArray());
    }

    public function deleteById(int $id): bool
    {
        $model = $this->skillCategoryModel::query()->find($id);
        return $model !== null && (bool) $model->delete();
    }
}
