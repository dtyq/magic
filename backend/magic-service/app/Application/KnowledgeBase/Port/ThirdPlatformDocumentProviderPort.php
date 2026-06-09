<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Port;

use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;

interface ThirdPlatformDocumentProviderPort
{
    /**
     * @return array<int, array{knowledge_base_id: string, name: string, description: string}>
     */
    public function listKnowledgeBases(KnowledgeBaseDataIsolation $dataIsolation): array;

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listDirectChildren(
        KnowledgeBaseDataIsolation $dataIsolation,
        int $parentId,
        int $lastFileId,
        int $pageSize,
    ): array;

    /**
     * @return array<string, mixed>
     */
    public function getFileInfo(KnowledgeBaseDataIsolation $dataIsolation, string $thirdFileId): array;

    public function getFileMarkdown(KnowledgeBaseDataIsolation $dataIsolation, string $thirdFileId): string;

    /**
     * @param array<int, string> $thirdFileIds
     * @return array<int, string>
     */
    public function getFileDownloadUrls(KnowledgeBaseDataIsolation $dataIsolation, array $thirdFileIds): array;
}
