<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Assembler\FlowVersion;

use App\Domain\Flow\Entity\MagicFlowVersionEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Flow\Assembler\Flow\MagicFlowAssembler;
use App\Interfaces\Flow\DTO\FlowVersion\MagicFlowVersionDTO;
use App\Interfaces\Flow\DTO\FlowVersion\MagicFlowVersionListDTO;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;
use DateTime;

class MagicFlowVersionAssembler
{
    /**
     * @param array<MagicFlowVersionEntity> $list
     */
    public static function createPageListDTO(int $total, array $list, Page $page, array $users = []): PageDTO
    {
        $list = array_map(fn (MagicFlowVersionEntity $magicFlowVersionEntity) => self::createMagicFlowVersionListDTO($magicFlowVersionEntity, $users), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }

    public static function createMagicFlowVersionDO(MagicFlowVersionDTO $magicFlowVersionDTO): MagicFlowVersionEntity
    {
        $entity = new MagicFlowVersionEntity();
        $entity->setFlowCode($magicFlowVersionDTO->getFlowCode());
        $entity->setCode((string) $magicFlowVersionDTO->getId());
        $entity->setName($magicFlowVersionDTO->getName());
        $entity->setDescription($magicFlowVersionDTO->getDescription());
        $entity->setMagicFlow(MagicFlowAssembler::createMagicFlowDO($magicFlowVersionDTO->getMagicFLow()));
        $entity->setCreatedAt(new DateTime());
        return $entity;
    }

    public static function createMagicFlowVersionDTO(MagicFlowVersionEntity $magicFlowVersionEntity, array $icons = []): MagicFlowVersionDTO
    {
        $dto = new MagicFlowVersionDTO($magicFlowVersionEntity->toArray());
        $dto->setId($magicFlowVersionEntity->getCode());
        $dto->getMagicFLow()->setId($magicFlowVersionEntity->getMagicFlow()->getCode());
        $dto->getMagicFLow()->setUserOperation($magicFlowVersionEntity->getMagicFlow()->getUserOperation());
        $dto->getMagicFLow()->setIcon(FileAssembler::getUrl($icons[$magicFlowVersionEntity->getMagicFlow()->getIcon()] ?? null));
        return $dto;
    }

    private static function createMagicFlowVersionListDTO(MagicFlowVersionEntity $magicFlowVersionEntity, array $users = []): MagicFlowVersionListDTO
    {
        $dto = new MagicFlowVersionListDTO($magicFlowVersionEntity->toArray());
        $dto->setId($magicFlowVersionEntity->getCode());
        $dto->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowVersionEntity->getCreator()] ?? null, $magicFlowVersionEntity->getCreatedAt()));
        $dto->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowVersionEntity->getModifier()] ?? null, $magicFlowVersionEntity->getUpdatedAt()));
        return $dto;
    }
}
