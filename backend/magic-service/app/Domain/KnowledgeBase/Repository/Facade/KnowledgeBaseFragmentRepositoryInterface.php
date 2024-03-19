<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Repository\Facade;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseFragmentQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface KnowledgeBaseFragmentRepositoryInterface
{
    public function getById(KnowledgeBaseDataIsolation $dataIsolation, int $id, bool $selectForUpdate = false): ?KnowledgeBaseFragmentEntity;

    /**
     * @return array<KnowledgeBaseFragmentEntity>
     */
    public function getByIds(KnowledgeBaseDataIsolation $dataIsolation, array $ids, bool $selectForUpdate = false): array;

    public function getByBusinessId(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, string $businessId): ?KnowledgeBaseFragmentEntity;

    public function getByPointId(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, string $pointId): ?KnowledgeBaseFragmentEntity;

    /**
     * @return array<KnowledgeBaseFragmentEntity>
     */
    public function getFragmentsByPointId(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, string $pointId, bool $selectForUpdate = false): array;

    public function save(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseFragmentEntity $magicFlowKnowledgeFragmentEntity): KnowledgeBaseFragmentEntity;

    /**
     * @return array{total: int, list: array<KnowledgeBaseFragmentEntity>}
     */
    public function queries(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseFragmentQuery $query, Page $page): array;

    public function count(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseFragmentQuery $query): int;

    public function destroy(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseFragmentEntity $magicFlowKnowledgeFragmentEntity): void;

    public function fragmentBatchDestroy(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, array $fragmentIds): void;

    public function destroyByKnowledgeCode(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode): void;

    public function changeSyncStatus(KnowledgeBaseFragmentEntity $entity): void;

    public function batchChangeSyncStatus(array $ids, KnowledgeSyncStatus $syncStatus, string $syncMessage = ''): void;

    public function rebuildByKnowledgeCode(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode): void;

    public function fragmentBatchDestroyByPointIds(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeCode, array $pointIds): void;

    /**
     * @return array<string, KnowledgeSyncStatus>
     */
    public function getFinalSyncStatusByDocumentCodes(KnowledgeBaseDataIsolation $dataIsolation, array $documentCodes): array;

    public function getFragmentsByEmptyDocumentCode(KnowledgeBaseDataIsolation $dataIsolation, int $lastId, int $pageSize): array;

    public function upsertById(KnowledgeBaseDataIsolation $dataIsolation, array $fragmentEntities): void;
}
