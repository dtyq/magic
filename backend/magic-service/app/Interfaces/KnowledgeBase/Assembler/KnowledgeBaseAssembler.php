<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Assembler;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Interfaces\KnowledgeBase\DTO\KnowledgeBaseDTO;
use App\Interfaces\KnowledgeBase\DTO\KnowledgeBaseListDTO;

class KnowledgeBaseAssembler
{
    public static function entityToDTO(KnowledgeBaseEntity $entity): KnowledgeBaseDTO
    {
        $dto = new KnowledgeBaseDTO();
        // 兼容旧知识库逻辑，旧知识库逻辑id为code
        $dto->setId($entity->getCode());
        $dto->setCode($entity->getCode());
        $dto->setName($entity->getName());
        $dto->setDescription($entity->getDescription());
        $dto->setType($entity->getType());
        $dto->setEnabled($entity->isEnabled());
        $dto->setBusinessId($entity->getBusinessId());
        $dto->setSyncStatus($entity->getSyncStatus()->value);
        $dto->setSyncStatusMessage($entity->getSyncStatusMessage());
        $dto->setModel($entity->getModel());
        $dto->setVectorDB($entity->getVectorDB());
        $dto->setOrganizationCode($entity->getOrganizationCode());
        $dto->setCreator($entity->getCreator());
        $dto->setCreatedAt($entity->getCreatedAt());
        $dto->setModifier($entity->getModifier());
        $dto->setUpdatedAt($entity->getUpdatedAt());

        $dto->setFragmentCount($entity->getFragmentCount());
        $dto->setExpectedCount($entity->getExpectedCount());
        $dto->setCompletedCount($entity->getCompletedCount());
        $dto->setUserOperation($entity->getUserOperation());
        $dto->setExpectedNum($entity->getExpectedNum());
        $dto->setCompletedNum($entity->getCompletedNum());
        $dto->setDocumentCount(0);
        $dto->setWordCount($entity->getWordCount());
        $dto->setIcon($entity->getIcon());
        $dto->setFragmentConfig($entity->getFragmentConfig());
        $dto->setEmbeddingConfig($entity->getEmbeddingConfig());
        $dto->setRetrieveConfig($entity->getRetrieveConfig());
        $dto->setSourceType($entity->getSourceType());

        return $dto;
    }

    public static function entitiesToListDTO(array $entities, array $users = [], array $knowledgeBaseDocumentCountMap = []): array
    {
        return array_map(
            fn (KnowledgeBaseEntity $entity) => KnowledgeBaseListDTO::fromEntity($entity, $users, $knowledgeBaseDocumentCountMap),
            $entities,
        );
    }
}
