<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Assembler;

use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
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

        return $DTO;
    }

    /**
     * @param array<SuperMagicAgentEntity> $list
     */
    public static function createPageListDTO(
        int $total,
        array $list,
        array $page
    ): array {
        $dtoList = [];
        foreach ($list as $entity) {
            $dtoList[] = self::createListDTO($entity);
        }

        return [
            'total' => $total,
            'list' => $dtoList,
            'page' => $page,
        ];
    }
}
