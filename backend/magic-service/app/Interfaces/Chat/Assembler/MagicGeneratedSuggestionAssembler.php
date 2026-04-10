<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Assembler;

use App\Domain\Chat\Entity\MagicGeneratedSuggestionEntity;
use App\Interfaces\Chat\DTO\Request\FollowUpSuggestionsQueryRequestDTO;
use App\Interfaces\Chat\DTO\Response\FollowUpSuggestionQueryResponseDTO;

class MagicGeneratedSuggestionAssembler
{
    public static function createQueryCriteria(FollowUpSuggestionsQueryRequestDTO $dto): MagicGeneratedSuggestionEntity
    {
        $entity = new MagicGeneratedSuggestionEntity();
        $entity->setType($dto->getType());
        $entity->setRelationId($dto->getRelationId());

        return $entity;
    }

    public static function entityToQueryResponseDto(MagicGeneratedSuggestionEntity $entity): FollowUpSuggestionQueryResponseDTO
    {
        $dto = new FollowUpSuggestionQueryResponseDTO();
        $dto->type = $entity->getType();
        $dto->relationId = $entity->getRelationId();
        $dto->status = $entity->getStatus()?->value;
        $dto->suggestions = $entity->getSuggestions();

        return $dto;
    }
}
