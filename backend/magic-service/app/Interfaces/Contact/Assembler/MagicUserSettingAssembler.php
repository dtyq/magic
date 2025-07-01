<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Contact\Assembler;

use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Contact\DTO\MagicUserSettingDTO;
use App\Interfaces\Kernel\DTO\PageDTO;

class MagicUserSettingAssembler
{
    public static function createEntity(MagicUserSettingDTO $dto): MagicUserSettingEntity
    {
        $entity = new MagicUserSettingEntity();
        $entity->setKey($dto->getKey());
        $entity->setValue($dto->getValue());
        return $entity;
    }

    public static function createDTO(MagicUserSettingEntity $entity): MagicUserSettingDTO
    {
        $dto = new MagicUserSettingDTO();
        $dto->setId($entity->getId());
        $dto->setKey($entity->getKey());
        $dto->setValue($entity->getValue());
        $dto->setCreatedAt($entity->getCreatedAt()->format('Y-m-d H:i:s'));
        $dto->setUpdatedAt($entity->getUpdatedAt()->format('Y-m-d H:i:s'));

        return $dto;
    }

    /**
     * @param array<MagicUserSettingEntity> $list
     */
    public static function createPageListDTO(int $total, array $list, Page $page): PageDTO
    {
        $list = array_map(
            static fn (MagicUserSettingEntity $entity) => self::createDTO($entity),
            $list
        );
        return new PageDTO($page->getPage(), $total, $list);
    }
}
