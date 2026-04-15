<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\Assembler;

use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\Design\Entity\ValueObject\ImageGenerationType;
use App\Interfaces\Design\DTO\ImageGenerationDTO;

/**
 * 图片生成装配器.
 */
class ImageGenerationAssembler
{
    public static function toDO(ImageGenerationDTO $dto): ImageGenerationEntity
    {
        $entity = new ImageGenerationEntity();
        $dto->getId() && $entity->setId($dto->getId());
        $dto->getProjectId() && $entity->setProjectId((int) $dto->getProjectId());
        $dto->getImageId() && $entity->setImageId($dto->getImageId());
        $dto->getModelId() && $entity->setModelId($dto->getModelId());
        $dto->getPrompt() && $entity->setPrompt($dto->getPrompt());
        $dto->getSize() && $entity->setSize($dto->getSize());
        $entity->setResolution($dto->getResolution() ?? '');
        $dto->getFileDir() && $entity->setFileDir($dto->getFileDir());
        $dto->getFileName() && $entity->setFileName($dto->getFileName());
        $dto->getReferenceImages() && $entity->setReferenceImages($dto->getReferenceImages());
        $dto->getReferenceImageOptions() && $entity->setReferenceImageOptions($dto->getReferenceImageOptions());
        $dto->getType() !== null && $entity->setType(ImageGenerationType::from($dto->getType()));
        return $entity;
    }

    public static function toDTO(ImageGenerationEntity $entity): ImageGenerationDTO
    {
        $dto = new ImageGenerationDTO();
        $dto->setId($entity->getId());
        $dto->setProjectId($entity->getProjectId());
        $dto->setImageId($entity->getImageId());
        $dto->setModelId($entity->getModelId());
        $dto->setPrompt($entity->getPrompt());
        $dto->setSize($entity->getSize());
        $dto->setResolution($entity->getResolution());
        $dto->setFileDir($entity->getFileDir());
        $dto->setFileName($entity->getFileName());
        $dto->setReferenceImages($entity->getReferenceImages());
        $dto->setType($entity->getType()->value);
        $dto->setStatus($entity->getStatus()->value);
        $dto->setErrorMessage($entity->getErrorMessage());
        $dto->setCreatedAt($entity->getCreatedAt());
        $dto->setUpdatedAt($entity->getUpdatedAt());
        $dto->setFileUrl($entity->getFileUrl());
        return $dto;
    }
}
