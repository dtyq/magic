<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Assembler;

use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ExternalDocumentFile;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\DocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\ExternalDocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\ThirdPlatformDocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ThirdPlatformDocumentFile;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\DocumentFileDTOInterface;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\ExternalDocumentFileDTO;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\ThirdPlatformDocumentFileDTO;

class KnowledgeBaseDocumentAssembler
{
    public static function documentFileDTOToVO(?DocumentFileDTOInterface $dto): ?DocumentFileInterface
    {
        if ($dto === null) {
            return null;
        }
        return match (get_class($dto)) {
            ExternalDocumentFileDTO::class => new ExternalDocumentFile($dto->toArray()),
            ThirdPlatformDocumentFileDTO::class => new ThirdPlatformDocumentFile($dto->toArray()),
            default => ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed),
        };
    }

    public static function documentFileVOToDTO(?DocumentFileInterface $documentFile): ?DocumentFileDTOInterface
    {
        if ($documentFile === null) {
            return null;
        }
        return match (true) {
            $documentFile instanceof ExternalDocumentFileInterface => new ExternalDocumentFileDTO($documentFile->toArray()),
            $documentFile instanceof ThirdPlatformDocumentFileInterface => new ThirdPlatformDocumentFileDTO($documentFile->toArray()),
            default => ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed),
        };
    }
}
