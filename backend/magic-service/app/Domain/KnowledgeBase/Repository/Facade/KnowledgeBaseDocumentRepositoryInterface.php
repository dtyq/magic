<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Repository\Facade;

use App\Domain\Flow\Entity\ValueObject\Query\KnowledgeBaseDocumentQuery;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseDocumentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;

/**
 * 知识库文档仓库接口.
 */
interface KnowledgeBaseDocumentRepositoryInterface
{
    /**
     * 创建知识库文档.
     */
    public function create(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): KnowledgeBaseDocumentEntity;

    /**
     * @param array<KnowledgeBaseDocumentEntity> $documentEntities
     */
    public function upsertByCode(KnowledgeBaseDataIsolation $dataIsolation, array $documentEntities): void;

    public function restoreOrCreate(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): KnowledgeBaseDocumentEntity;

    /**
     * 更新知识库文档.
     */
    public function update(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): KnowledgeBaseDocumentEntity;

    public function updateDocumentFile(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): int;

    public function updateWordCount(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeBaseCode, string $documentCode, int $deltaWordCount): void;

    /**
     * @return array array<知识库code, 文档数量>
     */
    public function getDocumentCountByKnowledgeBaseCode(KnowledgeBaseDataIsolation $dataIsolation, array $knowledgeBaseCodes): array;

    /**
     * @return array<string, KnowledgeBaseDocumentEntity> array<文档code, 文档名>
     */
    public function getDocumentsByCodes(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeBaseCode, array $knowledgeBaseDocumentCodes): array;

    /**
     * 查询知识库文档列表.
     *
     * @return array{total: int, list: array<KnowledgeBaseDocumentEntity>}
     */
    public function queries(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentQuery $query, Page $page): array;

    /**
     * 通过第三方文件id查询知识库文档列表.
     *
     * @return array<KnowledgeBaseDocumentEntity>
     */
    public function getByThirdFileId(KnowledgeBaseDataIsolation $dataIsolation, string $thirdPlatformType, string $thirdFileId, ?string $knowledgeBaseCode = null, ?int $lastId = null, int $pageSize = 500): array;

    /**
     * 查看单个知识库文档详情.
     */
    public function show(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeBaseCode, string $documentCode, bool $selectForUpdate = false): ?KnowledgeBaseDocumentEntity;

    /**
     * 删除知识库文档.
     */
    public function destroy(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeBaseCode, string $documentCode): void;

    /**
     * 根据文档编码删除所有片段.
     */
    public function destroyFragmentsByDocumentCode(KnowledgeBaseDataIsolation $dataIsolation, string $knowledgeBaseCode, string $documentCode): void;

    public function changeSyncStatus(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): void;

    public function increaseVersion(KnowledgeBaseDataIsolation $dataIsolation, KnowledgeBaseDocumentEntity $documentEntity): int;
}
