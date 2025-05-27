<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Assembler;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseDocumentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ExternalDocumentFile;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\DocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\ExternalDocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\ThirdPlatformDocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\ThirdPlatformDocumentFile;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\DocumentFileDTOInterface;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\ExternalDocumentFileDTO;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\ThirdPlatformDocumentFileDTO;
use App\Interfaces\KnowledgeBase\DTO\KnowledgeBaseDocumentDTO;
use App\Interfaces\KnowledgeBase\DTO\Request\CreateDocumentRequestDTO;
use App\Interfaces\KnowledgeBase\DTO\Request\UpdateDocumentRequestDTO;

class KnowledgeBaseDocumentAssembler
{
    public static function entityToDTO(KnowledgeBaseDocumentEntity $entity): KnowledgeBaseDocumentDTO
    {
        $data = $entity->toArray();
        $data['document_file'] = self::documentFileVOToDTO($entity->getDocumentFile());
        return new KnowledgeBaseDocumentDTO($data);
    }

    /**
     * 从创建DTO创建实体.
     */
    public static function createDTOToEntity(CreateDocumentRequestDTO $dto, MagicUserAuthorization $auth): KnowledgeBaseDocumentEntity
    {
        $data = $dto->toArray();
        $data['created_uid'] = $auth->getId();
        $data['updated_uid'] = $auth->getId();
        $data['name'] = $dto->getDocumentFile()->getName();
        unset($data['document_file']);
        return (new KnowledgeBaseDocumentEntity($data))->setDocumentFile(KnowledgeBaseDocumentAssembler::documentFileDTOToVO($dto->getDocumentFile()));
    }

    /**
     * 从更新DTO创建实体.
     */
    public static function updateDTOToEntity(UpdateDocumentRequestDTO $dto, MagicUserAuthorization $auth): KnowledgeBaseDocumentEntity
    {
        $data = $dto->toArray();
        $data['updated_uid'] = $auth->getId();
        if (is_null($data['fragment_config'])) {
            unset($data['fragment_config']);
        }
        return new KnowledgeBaseDocumentEntity($data);
    }

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
