<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Service;

use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillCategoryRelationType;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRelationRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRepositoryInterface;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class SkillCategoryRelationDomainService
{
    public function __construct(
        private readonly SkillCategoryRelationRepositoryInterface $relationRepository,
        private readonly SkillCategoryRepositoryInterface $categoryRepository,
    ) {
    }

    /** @param array<int, null|int|string> $categoryIds @return int[] */
    public function replaceVersionCategories(string $organizationCode, int $versionId, array $categoryIds): array
    {
        return $this->replace($organizationCode, SkillCategoryRelationType::SkillVersion, $versionId, $categoryIds);
    }

    /** @param array<int, null|int|string> $categoryIds @return int[] */
    public function replaceMarketCategories(string $organizationCode, int $marketId, array $categoryIds): array
    {
        return $this->replace($organizationCode, SkillCategoryRelationType::SkillMarket, $marketId, $categoryIds);
    }

    /** @return int[] */
    public function getVersionCategoryIds(int $versionId): array
    {
        return $this->relationRepository->findCategoryIds(SkillCategoryRelationType::SkillVersion, $versionId);
    }

    /** @return int[] */
    public function getMarketCategoryIds(int $marketId): array
    {
        return $this->relationRepository->findCategoryIds(SkillCategoryRelationType::SkillMarket, $marketId);
    }

    /** @param int[] $ids @return array<int, int[]> */
    public function getMarketCategoryIdsMap(array $ids): array
    {
        return $this->relationRepository->findCategoryIdsByRelationIds(SkillCategoryRelationType::SkillMarket, $ids);
    }

    /** @param int[] $ids @return array<int, int[]> */
    public function getVersionCategoryIdsMap(array $ids): array
    {
        return $this->relationRepository->findCategoryIdsByRelationIds(SkillCategoryRelationType::SkillVersion, $ids);
    }

    public function isMarketReferenced(int $categoryId): bool
    {
        return $this->relationRepository->countByCategoryId(SkillCategoryRelationType::SkillMarket, $categoryId) > 0;
    }

    /** @param int[] $categoryIds @return array<int, int> */
    public function getMarketReferenceCounts(array $categoryIds): array
    {
        return $this->relationRepository->countMarketRelationsByCategoryIds($categoryIds);
    }

    /** @param int[] $categoryIds @return array<int, int> */
    public function getVisiblePublishedMarketCounts(array $categoryIds): array
    {
        return $this->relationRepository->countMarketRelationsByCategoryIds($categoryIds, true, true);
    }

    /** @param int[] $categoryIds @return array<int, int[]> */
    public function getVisiblePublishedMarketIdsMap(array $categoryIds): array
    {
        return $this->relationRepository->findMarketIdsByCategoryIds($categoryIds, true, true);
    }

    /** @param int[] $categoryIds @return array<int, int[]> */
    public function getMarketIdsMap(array $categoryIds): array
    {
        return $this->relationRepository->findMarketIdsByCategoryIds($categoryIds);
    }

    /** @param array<int, null|int|string> $categoryIds @return int[] */
    public function normalizeCategoryIds(array $categoryIds): array
    {
        $result = [];
        foreach ($categoryIds as $categoryId) {
            $categoryId = (int) $categoryId;
            if ($categoryId > 0 && ! in_array($categoryId, $result, true)) {
                $result[] = $categoryId;
            }
        }
        return $result;
    }

    /** @param int[] $categoryIds */
    private function assertCategoriesExist(array $categoryIds): void
    {
        $existing = array_map(static fn ($category) => $category->getId(), $this->categoryRepository->findByIds($categoryIds));
        $missing = array_values(array_diff($categoryIds, $existing));
        if ($missing !== []) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => implode(',', $missing)]);
        }
    }

    /** @param array<int, null|int|string> $categoryIds @return int[] */
    private function replace(string $organizationCode, SkillCategoryRelationType $type, int $relationId, array $categoryIds): array
    {
        $categoryIds = $this->normalizeCategoryIds($categoryIds);
        $this->assertCategoriesExist($categoryIds);
        $this->relationRepository->replaceRelations($organizationCode, $type, $relationId, $categoryIds);
        return $categoryIds;
    }
}
