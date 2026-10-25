<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Repository\Facade;

use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillCategoryRelationType;

interface SkillCategoryRelationRepositoryInterface
{
    /** @param int[] $categoryIds */
    public function replaceRelations(string $organizationCode, SkillCategoryRelationType $type, int $relationId, array $categoryIds): void;

    /** @return int[] */
    public function findCategoryIds(SkillCategoryRelationType $type, int $relationId): array;

    /** @param int[] $relationIds @return array<int, int[]> */
    public function findCategoryIdsByRelationIds(SkillCategoryRelationType $type, array $relationIds): array;

    /** @param int[] $relationIds */
    public function deleteByRelationIds(SkillCategoryRelationType $type, array $relationIds): int;

    public function countByCategoryId(SkillCategoryRelationType $type, int $categoryId): int;

    /** @param int[] $categoryIds @return array<int, int> */
    public function countMarketRelationsByCategoryIds(array $categoryIds, bool $publishedOnly = false, bool $visibleOnly = false): array;

    /** @param int[] $categoryIds @return array<int, int[]> */
    public function findMarketIdsByCategoryIds(array $categoryIds, bool $publishedOnly = false, bool $visibleOnly = false): array;
}
