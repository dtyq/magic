<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service\Strategy\DocumentFile\Driver;

use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\Driver\Interfaces\ThirdPlatformDocumentFileStrategyInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocType;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\DocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ThirdPlatformDocumentFile;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;

class ThirdPlatformDocumentFileStrategyDriver implements ThirdPlatformDocumentFileStrategyInterface
{
    public function parseContent(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): string
    {
        // 这里实现第三方文档文件的文本解析逻辑
        return '';
    }

    public function parseDocType(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): int
    {
        // 这里实现第三方文档文件的文本格式解析逻辑
        return DocType::UNKNOWN->value;
    }

    public function parseThirdPlatformType(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): ?string
    {
        return $documentFile->getPlatformType();
    }

    public function parseThirdFileId(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): ?string
    {
        return $documentFile->getThirdFileId();
    }

    public function preProcessDocumentFiles(KnowledgeBaseDataIsolation $dataIsolation, array $documentFiles): array
    {
        $processedDocumentFiles = [];
        foreach ($documentFiles as $documentFile) {
            $processedDocumentFiles[] = $this->preProcessDocumentFile($dataIsolation, $documentFile);
        }
        return $processedDocumentFiles;
    }

    /**
     * @param ThirdPlatformDocumentFile $documentFile
     * @return ThirdPlatformDocumentFile
     */
    public function preProcessDocumentFile(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): DocumentFileInterface
    {
        $cloneDocumentFile = clone $documentFile;
        $docType = $this->parseDocType($dataIsolation, $cloneDocumentFile);
        $thirdPlatformType = $this->parseThirdPlatformType($dataIsolation, $cloneDocumentFile);
        $thirdPlatformId = $this->parseThirdFileId($dataIsolation, $cloneDocumentFile);
        return $cloneDocumentFile->setDocType($docType)
            ->setPlatformType($thirdPlatformType)
            ->setThirdFileId($thirdPlatformId);
    }

    public function validation(DocumentFileInterface $documentFile): bool
    {
        return $documentFile instanceof ThirdPlatformDocumentFile;
    }
}
