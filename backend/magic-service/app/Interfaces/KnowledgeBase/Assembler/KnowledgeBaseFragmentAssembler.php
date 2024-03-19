<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Assembler;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseFragmentQuery;
use App\Interfaces\KnowledgeBase\DTO\KnowledgeBaseFragmentDTO;
use App\Interfaces\KnowledgeBase\DTO\Request\GetFragmentListRequestDTO;

class KnowledgeBaseFragmentAssembler
{
    public static function entityToDTO(KnowledgeBaseFragmentEntity $entity): KnowledgeBaseFragmentDTO
    {
        $dto = new KnowledgeBaseFragmentDTO($entity->toArray());
        $dto->setKnowledgeBaseCode($entity->getKnowledgeCode());
        unset($dto->knowledgeCode);
        return $dto;
    }

    public static function createListDTO()
    {
    }

    public static function getFragmentListRequestDTOToQuery(GetFragmentListRequestDTO $dto): KnowledgeBaseFragmentQuery
    {
        $query = new KnowledgeBaseFragmentQuery($dto->toArray());
        $query->setKnowledgeCode($dto->getKnowledgeBaseCode());
        $query->setOrder(['updated_at' => 'desc']);
        return $query;
    }
}
