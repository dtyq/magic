<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service\Strategy\DocumentFile\Driver\Interfaces;

use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\DocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;

interface BaseDocumentFileStrategyInterface
{
    public function validation(DocumentFileInterface $documentFile): bool;

    public function parseContent(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): string;

    public function parseDocType(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): int;

    public function parseThirdPlatformType(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): ?string;

    public function parseThirdFileId(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): ?string;

    public function preProcessDocumentFiles(KnowledgeBaseDataIsolation $dataIsolation, array $documentFiles): array;

    public function preProcessDocumentFile(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): DocumentFileInterface;
}
