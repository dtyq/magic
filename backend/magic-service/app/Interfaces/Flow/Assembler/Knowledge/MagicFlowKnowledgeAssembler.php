<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Assembler\Knowledge;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;
use App\Interfaces\KnowledgeBase\DTO\KnowledgeBaseListDTO;

class MagicFlowKnowledgeAssembler
{
    /**
     * @param array<KnowledgeBaseEntity> $list
     */
    public static function createPageListDTO(int $total, array $list, Page $page, array $users): PageDTO
    {
        $list = array_map(fn (KnowledgeBaseEntity $entity) => self::createListDTO($entity, $users), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }

    protected static function createListDTO(KnowledgeBaseEntity $magicFlowKnowledgeEntity, array $users): KnowledgeBaseListDTO
    {
        $listDTO = new KnowledgeBaseListDTO($magicFlowKnowledgeEntity->toArray());
        $listDTO->setId($magicFlowKnowledgeEntity->getCode());
        $listDTO->setCreator($magicFlowKnowledgeEntity->getCreator());
        $listDTO->setCreatedAt($magicFlowKnowledgeEntity->getCreatedAt());
        $listDTO->setModifier($magicFlowKnowledgeEntity->getModifier());
        $listDTO->setUpdatedAt($magicFlowKnowledgeEntity->getUpdatedAt());
        $listDTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowKnowledgeEntity->getCreator()] ?? null, $magicFlowKnowledgeEntity->getCreatedAt()));
        $listDTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowKnowledgeEntity->getModifier()] ?? null, $magicFlowKnowledgeEntity->getUpdatedAt()));
        $listDTO->setUserOperation($magicFlowKnowledgeEntity->getUserOperation());
        $listDTO->setExpectedNum($magicFlowKnowledgeEntity->getExpectedNum());
        $listDTO->setCompletedNum($magicFlowKnowledgeEntity->getCompletedNum());
        return $listDTO;
    }
}
