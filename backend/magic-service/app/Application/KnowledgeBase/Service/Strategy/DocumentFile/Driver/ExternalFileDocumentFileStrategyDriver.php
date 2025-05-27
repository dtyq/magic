<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service\Strategy\DocumentFile\Driver;

use App\Application\KnowledgeBase\Service\Strategy\DocumentFile\Driver\Interfaces\ExternalFileDocumentFileStrategyInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocType;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ExternalDocumentFile;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\DocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Infrastructure\Core\File\Parser\FileParser;
use App\Infrastructure\Util\FileType;
use App\Infrastructure\Util\SSRF\Exception\SSRFException;
use Dtyq\CloudFile\Kernel\Struct\FileLink;

class ExternalFileDocumentFileStrategyDriver implements ExternalFileDocumentFileStrategyInterface
{
    /**
     * @param ExternalDocumentFile $documentFile
     * @throws SSRFException
     */
    public function parseContent(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): string
    {
        $fileLink = $this->getFileLink($dataIsolation->getCurrentOrganizationCode(), $documentFile->getKey());
        return di(FileParser::class)->parse($fileLink->getUrl(), true);
    }

    /**
     * @param ExternalDocumentFile $documentFile
     */
    public function parseDocType(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): int
    {
        if (! $documentFile->getDocType()) {
            $fileLink = $this->getFileLink($dataIsolation->getCurrentOrganizationCode(), $documentFile->getKey());
            $extension = FileType::getType($fileLink->getUrl());
            $documentFile->setDocType(DocType::fromExtension($extension)->value);
        }
        return $documentFile->getDocType();
    }

    /**
     * @param ExternalDocumentFile $documentFile
     */
    public function parseThirdPlatformType(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): ?string
    {
        return null;
    }

    /**
     * @param ExternalDocumentFile $documentFile
     */
    public function parseThirdFileId(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): ?string
    {
        return null;
    }

    /**
     * @return array<DocumentFileInterface>
     */
    public function preProcessDocumentFiles(KnowledgeBaseDataIsolation $dataIsolation, array $documentFiles): array
    {
        $processedDocumentFiles = [];
        foreach ($documentFiles as $documentFile) {
            $processedDocumentFiles[] = $this->preProcessDocumentFile($dataIsolation, $documentFile);
        }
        return $processedDocumentFiles;
    }

    /**
     * @param ExternalDocumentFile $documentFile
     */
    public function preProcessDocumentFile(KnowledgeBaseDataIsolation $dataIsolation, DocumentFileInterface $documentFile): DocumentFileInterface
    {
        $cloneDocumentFile = clone $documentFile;
        $this->parseDocType($dataIsolation, $cloneDocumentFile);
        return $cloneDocumentFile;
    }

    public function validation(DocumentFileInterface $documentFile): bool
    {
        return $documentFile instanceof ExternalDocumentFile;
    }

    private function getFileLink(string $organizationCode, string $icon): ?FileLink
    {
        return di(FileDomainService::class)->getLink($organizationCode, $icon);
    }
}
