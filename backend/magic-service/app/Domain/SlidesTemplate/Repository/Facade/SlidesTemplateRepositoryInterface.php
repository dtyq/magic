<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Repository\Facade;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface SlidesTemplateRepositoryInterface
{
    public function findById(SlidesTemplateDataIsolation $dataIsolation, int|string $id): ?SlidesTemplateEntity;

    public function findByCode(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateEntity;

    public function findByCodeWithTrashed(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateEntity;

    public function findGloballyByCodeWithTrashed(string $code): ?SlidesTemplateEntity;

    public function findOfficialByCode(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateEntity;

    /** @return SlidesTemplateEntity[] */
    public function findByCodes(SlidesTemplateDataIsolation $dataIsolation, array $codes): array;

    /** @return SlidesTemplateEntity[] */
    public function findByIds(SlidesTemplateDataIsolation $dataIsolation, array $ids): array;

    /** @return SlidesTemplateEntity[] */
    public function findVisibleByIds(
        SlidesTemplateDataIsolation $dataIsolation,
        array $ids,
    ): array;

    /** @return string[] */
    public function findIdsForSync(
        SlidesTemplateDataIsolation $dataIsolation,
        string $organizationCode,
        array $templateIds,
        ?string $categoryCode,
        array $tagCodes,
        string $tagMatch,
        string $afterId,
        int $limit
    ): array;

    /**
     * @return array{total: int, list: SlidesTemplateEntity[]}
     */
    public function queries(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query, Page $page): array;

    /**
     * @return array{total: int, list: SlidesTemplateEntity[]}
     */
    public function queriesFavorites(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query, Page $page): array;

    public function count(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query): int;

    public function sumTotalUsageCount(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query): int;

    public function countTodayCreated(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query): int;

    public function save(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateEntity $entity): SlidesTemplateEntity;

    public function updateStatus(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $status, string $updatedUid): bool;

    public function updateSort(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $sort, string $updatedUid): bool;

    public function incrementActualUsageCount(SlidesTemplateDataIsolation $dataIsolation, string $code, int $totalUsageIncrement): bool;

    public function updateBaseUsageCount(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $baseUsageCount, int $totalUsageCount, string $updatedUid): bool;

    /**
     * @return SlidesTemplateEntity[]
     */
    public function findRankedForUsageCount(SlidesTemplateDataIsolation $dataIsolation, int $offset, int $limit): array;

    public function countForUsageCount(SlidesTemplateDataIsolation $dataIsolation): int;

    public function updateUsageCounts(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $baseUsageCount, int $totalUsageCount): bool;

    public function delete(SlidesTemplateDataIsolation $dataIsolation, int|string $id): bool;
}
