<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\KnowledgeBase\ThirdPlatform;

use App\Application\KnowledgeBase\Port\ThirdPlatformDocumentProviderPort;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;

class UnsupportedThirdPlatformDocumentProvider implements ThirdPlatformDocumentProviderPort
{
    public function listKnowledgeBases(KnowledgeBaseDataIsolation $dataIsolation): array
    {
        return [];
    }

    public function listDirectChildren(
        KnowledgeBaseDataIsolation $dataIsolation,
        int $parentId,
        int $lastFileId,
        int $pageSize,
    ): array {
        return [];
    }

    public function getFileInfo(KnowledgeBaseDataIsolation $dataIsolation, string $thirdFileId): array
    {
        return [];
    }

    public function getFileMarkdown(KnowledgeBaseDataIsolation $dataIsolation, string $thirdFileId): string
    {
        return '';
    }

    public function getFileDownloadUrls(KnowledgeBaseDataIsolation $dataIsolation, array $thirdFileIds): array
    {
        return [];
    }
}
