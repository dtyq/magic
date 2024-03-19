<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Assembler\TriggerTestcase;

use App\Domain\Flow\Entity\MagicFlowTriggerTestcaseEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Flow\DTO\TriggerTestcase\MagicFlowTriggerTestcaseDTO;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;

class MagicFlowTriggerTestcaseAssembler
{
    /**
     * @param array<MagicFlowTriggerTestcaseEntity> $list
     */
    public static function createPageListDTO(int $total, array $list, Page $page, array $users = []): PageDTO
    {
        $list = array_map(fn (MagicFlowTriggerTestcaseEntity $magicFlowTriggerTestcaseEntity) => self::createMagicFlowTriggerTestcaseDTO($magicFlowTriggerTestcaseEntity, $users), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }

    public static function createMagicFlowTriggerTestcaseDO(MagicFlowTriggerTestcaseDTO $magicFlowTriggerTestcaseDTO): MagicFlowTriggerTestcaseEntity
    {
        $entity = new MagicFlowTriggerTestcaseEntity();
        $entity->setFlowCode($magicFlowTriggerTestcaseDTO->getFlowCode());
        $entity->setCode($magicFlowTriggerTestcaseDTO->getId());
        $entity->setName($magicFlowTriggerTestcaseDTO->getName());
        $entity->setDescription($magicFlowTriggerTestcaseDTO->getDescription());
        $entity->setCaseConfig($magicFlowTriggerTestcaseDTO->getCaseConfig());
        return $entity;
    }

    public static function createMagicFlowTriggerTestcaseDTO(MagicFlowTriggerTestcaseEntity $magicFlowTriggerTestcaseEntity, array $users = []): MagicFlowTriggerTestcaseDTO
    {
        $dto = new MagicFlowTriggerTestcaseDTO();
        $dto->setId($magicFlowTriggerTestcaseEntity->getCode());
        $dto->setName($magicFlowTriggerTestcaseEntity->getName());
        $dto->setDescription($magicFlowTriggerTestcaseEntity->getDescription());
        $dto->setCreator($magicFlowTriggerTestcaseEntity->getCreator());
        $dto->setCreatedAt($magicFlowTriggerTestcaseEntity->getCreatedAt());
        $dto->setModifier($magicFlowTriggerTestcaseEntity->getModifier());
        $dto->setUpdatedAt($magicFlowTriggerTestcaseEntity->getUpdatedAt());
        $dto->setFlowCode($magicFlowTriggerTestcaseEntity->getFlowCode());
        $dto->setCaseConfig($magicFlowTriggerTestcaseEntity->getCaseConfig());

        $dto->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowTriggerTestcaseEntity->getCreator()] ?? null, $magicFlowTriggerTestcaseEntity->getCreatedAt()));
        $dto->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowTriggerTestcaseEntity->getModifier()] ?? null, $magicFlowTriggerTestcaseEntity->getUpdatedAt()));

        return $dto;
    }
}
