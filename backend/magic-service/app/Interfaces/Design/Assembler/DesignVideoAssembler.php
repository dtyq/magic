<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\Assembler;

use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\Dto\DesignVideoCreateDTO;
use App\Domain\Design\Entity\ValueObject\DesignGenerationType;
use App\Domain\Design\Factory\DesignGenerationTaskFactory;
use App\Domain\Design\Factory\DesignVideoInputPayloadPreparer;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationType;
use App\Interfaces\Design\DTO\VideoGenerationDTO;

final class DesignVideoAssembler
{
    public static function toDO(DesignVideoCreateDTO $dto): DesignGenerationTaskEntity
    {
        DesignVideoInputPayloadPreparer::sanitizeDtoForCreate($dto);
        return DesignGenerationTaskFactory::createVideoTask($dto);
    }

    public static function toDTO(DesignGenerationTaskEntity $entity): VideoGenerationDTO
    {
        $dto = new VideoGenerationDTO();
        $dto->setProjectId($entity->getProjectId());
        $dto->setVideoId($entity->getGenerationId());
        $dto->setModelId($entity->getModelId());
        $dto->setPrompt($entity->getPrompt());
        $dto->setFileDir($entity->getFileDir());
        $dto->setFileName($entity->getFileName() !== '' ? $entity->getFileName() : null);
        $dto->setType(match ($entity->getGenerationType()) {
            DesignGenerationType::TEXT_TO_VIDEO => VideoGenerationType::TEXT_TO_VIDEO->value,
            DesignGenerationType::IMAGE_TO_VIDEO => VideoGenerationType::IMAGE_TO_VIDEO->value,
        });
        $dto->setStatus($entity->getStatus()->value);
        $dto->setErrorMessage($entity->getStatus()->value === 'failed' ? $entity->getErrorMessage() : null);
        $dto->setCreatedAt($entity->getCreatedAt());
        $dto->setUpdatedAt($entity->getUpdatedAt());
        $dto->setFileId($entity->getFileId());
        $dto->setFileUrl($entity->getFileUrl());
        $dto->setPosterFileId($entity->getPosterFileId());
        $dto->setPosterUrl($entity->getPosterUrl());

        return $dto;
    }
}
