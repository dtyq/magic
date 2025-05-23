<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\Assembler;

use App\Domain\Authentication\Entity\ApiKeyProviderEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authentication\DTO\ApiKeyProviderDTO;
use App\Interfaces\Kernel\DTO\PageDTO;

class ApiKeyProviderAssembler
{
    public static function createDO(ApiKeyProviderDTO $dto): ApiKeyProviderEntity
    {
        $entity = new ApiKeyProviderEntity();
        $entity->setCode($dto->getId());
        $entity->setRelType($dto->getRelType());
        $entity->setRelCode($dto->getRelCode());
        $entity->setName($dto->getName());
        $entity->setDescription($dto->getDescription());
        $entity->setEnabled($dto->isEnabled());
        return $entity;
    }

    public static function createDTO(ApiKeyProviderEntity $entity): ApiKeyProviderDTO
    {
        $dto = new ApiKeyProviderDTO();
        $dto->setId($entity->getCode());
        $dto->setOrganizationCode($entity->getOrganizationCode());
        $dto->setRelCode($entity->getRelCode());
        $dto->setRelType($entity->getRelType()->value);
        $dto->setName($entity->getName());
        $dto->setDescription($entity->getDescription());
        $dto->setSecretKey($entity->getSecretKey());
        $dto->setEnabled($entity->isEnabled());
        $dto->setCreator($entity->getCreator());
        $dto->setCreatedAt($entity->getCreatedAt());
        $dto->setModifier($entity->getModifier());
        $dto->setUpdatedAt($entity->getUpdatedAt());
        $dto->setConversationId($entity->getConversationId());
        $dto->setLastUsed($entity->getLastUsed());
        return $dto;
    }

    public static function createPageListDTO(int $total, array $list, Page $page): PageDTO
    {
        $list = array_map(fn (ApiKeyProviderEntity $entity) => self::createDTO($entity), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }
}
