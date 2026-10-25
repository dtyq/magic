<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Service;

use App\Domain\SuperMagic\Skill\Entity\SkillCategoryEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillCategoryQuery;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRepositoryInterface;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

/**
 * Skill 分类领域服务.
 */
class SkillCategoryDomainService
{
    private const MAX_DEPTH = 2;

    public function __construct(
        protected SkillCategoryRepositoryInterface $skillCategoryRepository,
        protected SkillCategoryRelationDomainService $relationDomainService
    ) {
    }

    /** @return SkillCategoryEntity[] */
    public function findAll(): array
    {
        return $this->skillCategoryRepository->findAll();
    }

    public function findById(int $id): ?SkillCategoryEntity
    {
        return $this->skillCategoryRepository->findById($id);
    }

    /** @param int[] $ids @return SkillCategoryEntity[] */
    public function findByIds(array $ids): array
    {
        return $this->skillCategoryRepository->findByIds($ids);
    }

    /** @return SkillCategoryEntity[] */
    public function findByQuery(SkillCategoryQuery $query): array
    {
        return $this->skillCategoryRepository->findByQuery($query);
    }

    public function save(SkillCategoryEntity $category): SkillCategoryEntity
    {
        $this->assertParentCanBeUsed($category);
        return $this->skillCategoryRepository->save($category);
    }

    public function deleteById(int $id): bool
    {
        if ($this->skillCategoryRepository->findChildren($id) !== [] || $this->relationDomainService->isMarketReferenced($id)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'common.operation_failed');
        }
        return $this->skillCategoryRepository->deleteById($id);
    }

    /** @param int[] $categoryIds @return int[] */
    public function findSelfAndDescendantIds(array $categoryIds): array
    {
        return $this->skillCategoryRepository->findSelfAndDescendantIds($categoryIds);
    }

    /** @param int[] $categoryIds */
    public function assertIdsExist(array $categoryIds): void
    {
        $categoryIds = array_values(array_unique(array_filter(array_map('intval', $categoryIds))));
        if ($categoryIds === []) {
            return;
        }
        $existingIds = array_map(
            static fn (SkillCategoryEntity $category): int => (int) $category->getId(),
            $this->findByIds($categoryIds)
        );
        $missingIds = array_values(array_diff($categoryIds, $existingIds));
        if ($missingIds !== []) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => implode(',', $missingIds)]);
        }
    }

    /** @param int[] $categoryIds @return array<int, int> */
    public function getMarketReferenceCounts(array $categoryIds): array
    {
        return $this->relationDomainService->getMarketReferenceCounts($categoryIds);
    }

    /** @param int[] $categoryIds @return array<int, int> */
    public function getVisiblePublishedMarketCounts(array $categoryIds): array
    {
        return $this->relationDomainService->getVisiblePublishedMarketCounts($categoryIds);
    }

    /** @param int[] $categoryIds @return array<int, int[]> */
    public function getVisiblePublishedMarketIdsMap(array $categoryIds): array
    {
        return $this->relationDomainService->getVisiblePublishedMarketIdsMap($categoryIds);
    }

    /** @param int[] $categoryIds @return array<int, int[]> */
    public function getMarketIdsMap(array $categoryIds): array
    {
        return $this->relationDomainService->getMarketIdsMap($categoryIds);
    }

    private function assertParentCanBeUsed(SkillCategoryEntity $category): void
    {
        $parentId = $category->getParentId();
        if ($parentId === 0) {
            return;
        }

        $parent = $this->findById($parentId);
        if ($parent === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $parentId]);
        }

        if ($category->getId() !== null && $category->getId() === $parentId) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'common.operation_failed');
        }

        $parentDepth = 1;
        $visited = [$parentId => true];
        while ($parent->getParentId() !== 0) {
            $ancestorId = $parent->getParentId();
            if (isset($visited[$ancestorId]) || $ancestorId === $category->getId()) {
                ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'common.operation_failed');
            }
            $visited[$ancestorId] = true;
            $parent = $this->findById($ancestorId);
            if ($parent === null) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $ancestorId]);
            }
            ++$parentDepth;
        }

        if ($parentDepth + 1 > self::MAX_DEPTH) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'common.operation_failed');
        }
    }
}
