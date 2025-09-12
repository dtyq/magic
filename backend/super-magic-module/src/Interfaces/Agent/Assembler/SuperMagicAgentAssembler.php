<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Assembler;

use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\SuperMagicAgentCategorizedListDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\SuperMagicAgentDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\SuperMagicAgentListDTO;

class SuperMagicAgentAssembler
{
    public static function createDTO(SuperMagicAgentEntity $superMagicAgentEntity, array $users = [], bool $withPromptString = false): SuperMagicAgentDTO
    {
        $DTO = new SuperMagicAgentDTO();
        $DTO->setId($superMagicAgentEntity->getCode());
        $DTO->setName($superMagicAgentEntity->getName());
        $DTO->setDescription($superMagicAgentEntity->getDescription());
        $DTO->setIcon($superMagicAgentEntity->getIcon());
        $DTO->setPrompt($superMagicAgentEntity->getPrompt());
        $DTO->setType($superMagicAgentEntity->getType()->value);
        $DTO->setEnabled($superMagicAgentEntity->isEnabled());
        $DTO->setTools($superMagicAgentEntity->getTools());

        // Set promptString if requested
        if ($withPromptString) {
            $DTO->setPromptString($superMagicAgentEntity->getPromptString());
        }

        $DTO->setCreator($superMagicAgentEntity->getCreator());
        $DTO->setCreatedAt($superMagicAgentEntity->getCreatedAt());
        $DTO->setModifier($superMagicAgentEntity->getModifier());
        $DTO->setUpdatedAt($superMagicAgentEntity->getUpdatedAt());
        $DTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$superMagicAgentEntity->getCreator()] ?? null, $superMagicAgentEntity->getCreatedAt()));
        $DTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$superMagicAgentEntity->getModifier()] ?? null, $superMagicAgentEntity->getUpdatedAt()));

        return $DTO;
    }

    public static function createDO(SuperMagicAgentDTO $superMagicAgentDTO): SuperMagicAgentEntity
    {
        $superMagicAgentEntity = new SuperMagicAgentEntity();
        $superMagicAgentEntity->setCode((string) $superMagicAgentDTO->getId());
        $superMagicAgentEntity->setName($superMagicAgentDTO->getName());
        $superMagicAgentEntity->setDescription($superMagicAgentDTO->getDescription());
        $superMagicAgentEntity->setIcon($superMagicAgentDTO->getIcon());
        $superMagicAgentEntity->setPrompt($superMagicAgentDTO->getPrompt());
        $superMagicAgentEntity->setTools($superMagicAgentDTO->getTools());

        if ($superMagicAgentDTO->getEnabled() !== null) {
            $superMagicAgentEntity->setEnabled($superMagicAgentDTO->getEnabled());
        }

        return $superMagicAgentEntity;
    }

    public static function createListDTO(SuperMagicAgentEntity $superMagicAgentEntity): SuperMagicAgentListDTO
    {
        $DTO = new SuperMagicAgentListDTO();
        $DTO->setId($superMagicAgentEntity->getCode());
        $DTO->setName($superMagicAgentEntity->getName());
        $DTO->setDescription($superMagicAgentEntity->getDescription());
        $DTO->setIcon($superMagicAgentEntity->getIcon());
        $DTO->setType($superMagicAgentEntity->getType()->value);

        return $DTO;
    }

    /**
     * @param array<SuperMagicAgentEntity> $list
     */
    public static function createPageListDTO(array $list, int $total, Page $page): PageDTO
    {
        $dtoList = [];
        foreach ($list as $entity) {
            $dtoList[] = self::createListDTO($entity);
        }

        return new PageDTO($page->getPage(), $total, $dtoList);
    }

    /**
     * 创建分类列表DTO.
     */
    public static function createCategorizedListDTO(array $frequent, array $all, int $total): SuperMagicAgentCategorizedListDTO
    {
        $frequentDTOs = [];
        foreach ($frequent as $entity) {
            $frequentDTOs[] = self::createListDTO($entity);
        }

        $allDTOs = [];
        foreach ($all as $entity) {
            $allDTOs[] = self::createListDTO($entity);
        }

        return new SuperMagicAgentCategorizedListDTO([
            'frequent' => $frequentDTOs,
            'all' => $allDTOs,
            'total' => $total,
        ]);
    }
}
