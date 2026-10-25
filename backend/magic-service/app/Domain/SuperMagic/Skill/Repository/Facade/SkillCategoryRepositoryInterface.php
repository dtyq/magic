<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Repository\Facade;

use App\Domain\SuperMagic\Skill\Entity\SkillCategoryEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillCategoryQuery;

/**
 * Skill 分类仓储接口.
 */
interface SkillCategoryRepositoryInterface
{
    public function findById(int $id): ?SkillCategoryEntity;

    /** @param int[] $ids @return SkillCategoryEntity[] */
    public function findByIds(array $ids): array;

    /** @return SkillCategoryEntity[] */
    public function findByQuery(SkillCategoryQuery $query): array;

    /** @return SkillCategoryEntity[] */
    public function findAll(): array;

    /** @return SkillCategoryEntity[] */
    public function findChildren(int $parentId): array;

    /** @param int[] $categoryIds @return int[] */
    public function findSelfAndDescendantIds(array $categoryIds): array;

    public function save(SkillCategoryEntity $entity): SkillCategoryEntity;

    public function deleteById(int $id): bool;
}
