<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Service;

use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentCategoryRelationType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentCategoryRelationRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentCategoryRepositoryInterface;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class SuperMagicAgentCategoryRelationDomainService
{
    public function __construct(
        private readonly AgentCategoryRelationRepositoryInterface $relationRepository,
        private readonly AgentCategoryRepositoryInterface $categoryRepository,
    ) {
    }

    /** @param array<int, null|int|string> $categoryIds */
    public function replaceVersionCategories(SuperMagicAgentDataIsolation $dataIsolation, int $agentVersionId, array $categoryIds): array
    {
        return $this->replaceCategories($dataIsolation, AgentCategoryRelationType::AgentVersion, $agentVersionId, $categoryIds);
    }

    /** @param array<int, null|int|string> $categoryIds */
    public function replaceMarketCategories(SuperMagicAgentDataIsolation $dataIsolation, int $agentMarketId, array $categoryIds): array
    {
        return $this->replaceCategories($dataIsolation, AgentCategoryRelationType::AgentMarket, $agentMarketId, $categoryIds);
    }

    /** @return int[] */
    public function getVersionCategoryIds(int $agentVersionId): array
    {
        return $this->normalizeCategoryIds($this->relationRepository->findCategoryIds(AgentCategoryRelationType::AgentVersion, $agentVersionId));
    }

    /** @return int[] */
    public function getMarketCategoryIds(int $agentMarketId): array
    {
        return $this->normalizeCategoryIds($this->relationRepository->findCategoryIds(AgentCategoryRelationType::AgentMarket, $agentMarketId));
    }

    /**
     * @param int[] $agentVersionIds
     * @return array<int, int[]>
     */
    public function getVersionCategoryIdsMap(array $agentVersionIds): array
    {
        return $this->relationRepository->findCategoryIdsByRelationIds(AgentCategoryRelationType::AgentVersion, $agentVersionIds);
    }

    /**
     * @param int[] $agentMarketIds
     * @return array<int, int[]>
     */
    public function getMarketCategoryIdsMap(array $agentMarketIds): array
    {
        return $this->relationRepository->findCategoryIdsByRelationIds(AgentCategoryRelationType::AgentMarket, $agentMarketIds);
    }

    /** @param int[] $agentVersionIds */
    public function deleteVersionCategoriesByRelationIds(array $agentVersionIds): int
    {
        return $this->relationRepository->deleteByRelationIds(AgentCategoryRelationType::AgentVersion, $agentVersionIds);
    }

    /** @param int[] $agentMarketIds */
    public function deleteMarketCategoriesByRelationIds(array $agentMarketIds): int
    {
        return $this->relationRepository->deleteByRelationIds(AgentCategoryRelationType::AgentMarket, $agentMarketIds);
    }

    /**
     * @param array<int, null|int|string> $categoryIds
     * @return int[]
     */
    public function normalizeCategoryIds(array $categoryIds): array
    {
        $normalized = [];
        foreach ($categoryIds as $categoryId) {
            $categoryId = (int) $categoryId;
            if ($categoryId <= 0 || in_array($categoryId, $normalized, true)) {
                continue;
            }
            $normalized[] = $categoryId;
        }

        return $normalized;
    }

    /**
     * @param array<int, null|int|string> $categoryIds
     * @return int[]
     */
    private function replaceCategories(
        SuperMagicAgentDataIsolation $dataIsolation,
        AgentCategoryRelationType $relationType,
        int $relationId,
        array $categoryIds
    ): array {
        $categoryIds = $this->normalizeCategoryIds($categoryIds);
        $this->assertCategoriesExist($categoryIds);
        $this->relationRepository->replaceRelations($dataIsolation, $relationType, $relationId, $categoryIds);
        return $categoryIds;
    }

    /** @param int[] $categoryIds */
    private function assertCategoriesExist(array $categoryIds): void
    {
        if ($categoryIds === []) {
            return;
        }

        $categories = $this->categoryRepository->findByIds($categoryIds);
        $existingIds = [];
        foreach ($categories as $category) {
            if ($category->getId() !== null) {
                $existingIds[] = $category->getId();
            }
        }

        $missingIds = array_values(array_diff($categoryIds, $existingIds));
        if ($missingIds === []) {
            return;
        }

        ExceptionBuilder::throw(
            SuperMagicErrorCode::NotFound,
            'common.not_found',
            ['label' => implode(',', $missingIds)]
        );
    }
}
