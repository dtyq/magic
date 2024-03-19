<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Assembler\ToolSet;

use App\Domain\Flow\Entity\MagicFlowToolSetEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Flow\DTO\ToolSet\MagicFlowToolSetDTO;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;
use Dtyq\CloudFile\Kernel\Struct\FileLink;

class MagicFlowToolSetAssembler
{
    public static function createDTO(MagicFlowToolSetEntity $magicFlowToolSetEntity, array $icons = [], array $users = []): MagicFlowToolSetDTO
    {
        $DTO = new MagicFlowToolSetDTO();
        $DTO->setId($magicFlowToolSetEntity->getCode());
        $DTO->setName($magicFlowToolSetEntity->getName());
        $DTO->setDescription($magicFlowToolSetEntity->getDescription());
        $DTO->setIcon(FileAssembler::getUrl($icons[$magicFlowToolSetEntity->getIcon()] ?? null));
        $DTO->setEnabled($magicFlowToolSetEntity->getEnabled());
        $DTO->setCreator($magicFlowToolSetEntity->getCreator());
        $DTO->setCreatedAt($magicFlowToolSetEntity->getCreatedAt());
        $DTO->setModifier($magicFlowToolSetEntity->getModifier());
        $DTO->setUpdatedAt($magicFlowToolSetEntity->getUpdatedAt());
        $DTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowToolSetEntity->getCreator()] ?? null, $magicFlowToolSetEntity->getCreatedAt()));
        $DTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowToolSetEntity->getModifier()] ?? null, $magicFlowToolSetEntity->getUpdatedAt()));
        $DTO->setTools($magicFlowToolSetEntity->getTools());
        $DTO->setUserOperation($magicFlowToolSetEntity->getUserOperation());
        return $DTO;
    }

    public static function createDO(MagicFlowToolSetDTO $magicFlowToolSetDTO): MagicFlowToolSetEntity
    {
        $magicFlowToolSetEntity = new MagicFlowToolSetEntity();
        $magicFlowToolSetEntity->setCode((string) $magicFlowToolSetDTO->getId());
        $magicFlowToolSetEntity->setName($magicFlowToolSetDTO->getName());
        $magicFlowToolSetEntity->setDescription($magicFlowToolSetDTO->getDescription());
        $magicFlowToolSetEntity->setIcon(FileAssembler::formatPath($magicFlowToolSetDTO->getIcon()));
        $magicFlowToolSetEntity->setEnabled($magicFlowToolSetDTO->getEnabled());
        return $magicFlowToolSetEntity;
    }

    /**
     * @param array<string, FileLink> $icons
     */
    public static function createPageListDTO(int $total, array $list, Page $page, array $users = [], array $icons = []): PageDTO
    {
        $list = array_map(fn (MagicFlowToolSetEntity $magicFlowToolSetEntity) => self::createDTO($magicFlowToolSetEntity, $icons, $users), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }
}
