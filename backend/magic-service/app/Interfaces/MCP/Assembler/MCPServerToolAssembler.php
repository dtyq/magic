<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Assembler;

use App\Domain\MCP\Entity\MCPServerToolEntity;
use App\Domain\MCP\Entity\ValueObject\ToolSource;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;
use App\Interfaces\MCP\DTO\MCPServerToolDTO;

class MCPServerToolAssembler
{
    public static function createDTO(MCPServerToolEntity $entity, array $users = [], array $sourcesInfo = [], bool $showOptions = true): MCPServerToolDTO
    {
        $DTO = new MCPServerToolDTO();
        $DTO->setId($entity->getId());
        $DTO->setMcpServerCode($entity->getMcpServerCode());
        $DTO->setName($entity->getName());
        $DTO->setDescription($entity->getDescription());
        $DTO->setSource($entity->getSource()->value);
        $DTO->setRelCode($entity->getRelCode());
        $DTO->setRelVersionCode($entity->getRelVersionCode());
        $DTO->setVersion($entity->getVersion());
        $DTO->setEnabled($entity->isEnabled());
        $showOptions && $DTO->setOptions($entity->getOptions()->toArray());
        $DTO->setRelInfo($entity->getRelInfo());
        $DTO->setCreator($entity->getCreator());
        $DTO->setCreatedAt($entity->getCreatedAt());
        $DTO->setModifier($entity->getModifier());
        $DTO->setUpdatedAt($entity->getUpdatedAt());
        $DTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$entity->getCreator()] ?? null, $entity->getCreatedAt()));
        $DTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$entity->getModifier()] ?? null, $entity->getUpdatedAt()));
        $DTO->setSourceVersion($sourcesInfo[$entity->getSource()->value][$entity->getRelCode()] ?? []);
        return $DTO;
    }

    public static function createDO(MCPServerToolDTO $DTO): MCPServerToolEntity
    {
        $entity = new MCPServerToolEntity();
        $entity->setId($DTO->getId());
        $entity->setMcpServerCode($DTO->getMcpServerCode());
        $entity->setName($DTO->getName());
        $entity->setDescription($DTO->getDescription());
        $entity->setSource(ToolSource::fromValue($DTO->getSource()) ?? ToolSource::Unknown);
        $entity->setRelCode($DTO->getRelCode());
        $entity->setRelVersionCode($DTO->getRelVersionCode());
        $entity->setVersion($DTO->getVersion());
        $entity->setRelInfo($DTO->getRelInfo());

        if ($DTO->getEnabled() !== null) {
            $entity->setEnabled($DTO->getEnabled());
        }

        return $entity;
    }

    /**
     * @param array<MCPServerToolEntity> $list
     */
    public static function createPageListDTO(int $total, array $list, Page $page, array $users = [], array $sourcesInfo = []): PageDTO
    {
        $list = array_map(fn (MCPServerToolEntity $entity) => self::createDTO($entity, $users, $sourcesInfo, false), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }
}
