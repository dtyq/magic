<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Assembler;

use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\ServiceType;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;
use App\Interfaces\MCP\DTO\MCPServerDTO;
use Dtyq\CloudFile\Kernel\Struct\FileLink;

class MCPServerAssembler
{
    public static function createDTO(MCPServerEntity $mcpServerEntity, array $icons = [], array $users = []): MCPServerDTO
    {
        $DTO = new MCPServerDTO();
        $DTO->setId($mcpServerEntity->getCode());
        $DTO->setName($mcpServerEntity->getName());
        $DTO->setDescription($mcpServerEntity->getDescription());
        $DTO->setIcon(FileAssembler::getUrl($icons[$mcpServerEntity->getIcon()] ?? null));
        $DTO->setType($mcpServerEntity->getType()->value);
        $DTO->setEnabled($mcpServerEntity->isEnabled());
        $DTO->setExternalSseUrl($mcpServerEntity->getExternalSseUrl());
        $DTO->setCreator($mcpServerEntity->getCreator());
        $DTO->setCreatedAt($mcpServerEntity->getCreatedAt());
        $DTO->setModifier($mcpServerEntity->getModifier());
        $DTO->setUpdatedAt($mcpServerEntity->getUpdatedAt());
        $DTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$mcpServerEntity->getCreator()] ?? null, $mcpServerEntity->getCreatedAt()));
        $DTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$mcpServerEntity->getModifier()] ?? null, $mcpServerEntity->getUpdatedAt()));
        $DTO->setUserOperation($mcpServerEntity->getUserOperation());
        $DTO->setToolsCount($mcpServerEntity->getToolsCount());
        return $DTO;
    }

    public static function createDO(MCPServerDTO $mcpServerDTO): MCPServerEntity
    {
        $mcpServerEntity = new MCPServerEntity();
        $mcpServerEntity->setCode((string) $mcpServerDTO->getId());
        $mcpServerEntity->setName($mcpServerDTO->getName());
        $mcpServerEntity->setDescription($mcpServerDTO->getDescription());
        $mcpServerEntity->setIcon(FileAssembler::formatPath($mcpServerDTO->getIcon()));

        if ($mcpServerDTO->getType()) {
            $mcpServerEntity->setType(ServiceType::from($mcpServerDTO->getType()));
        }

        if ($mcpServerDTO->getEnabled() !== null) {
            $mcpServerEntity->setEnabled($mcpServerDTO->getEnabled());
        }

        $mcpServerEntity->setExternalSseUrl($mcpServerDTO->getExternalSseUrl());

        return $mcpServerEntity;
    }

    /**
     * @param array<string, FileLink> $icons
     */
    public static function createPageListDTO(int $total, array $list, Page $page, array $users = [], array $icons = []): PageDTO
    {
        $list = array_map(fn (MCPServerEntity $mcpServerEntity) => self::createDTO($mcpServerEntity, $icons, $users), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }
}
