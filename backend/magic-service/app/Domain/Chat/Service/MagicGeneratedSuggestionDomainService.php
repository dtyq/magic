<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Domain\Chat\Entity\MagicGeneratedSuggestionEntity;
use App\Domain\Chat\Entity\ValueObject\GeneratedSuggestionStatus;
use App\Domain\Chat\Repository\Facade\MagicGeneratedSuggestionRepositoryInterface;

class MagicGeneratedSuggestionDomainService
{
    public function __construct(
        private readonly MagicGeneratedSuggestionRepositoryInterface $generatedSuggestionRepository,
    ) {
    }

    public function queryByCriteria(MagicGeneratedSuggestionEntity $criteria): MagicGeneratedSuggestionEntity
    {
        $type = $criteria->getType();
        $relationId = $criteria->getRelationId();

        $entity = $this->generatedSuggestionRepository->findLatestEntityByTypeAndRelationId(
            $type,
            $relationId,
        );

        // 兼容之前没有对应推荐问题的消息
        if ($entity === null) {
            return MagicGeneratedSuggestionEntity::emptyForMissingQuery($type, $relationId);
        }

        return $entity;
    }

    public function createGenerating(
        int $type,
        int|string $relationId,
        array $params = [],
        null|int|string $createdUid = null,
    ): array {
        return $this->generatedSuggestionRepository->createGenerating(
            $type,
            $relationId,
            $params,
            $createdUid,
        );
    }

    /**
     * @param string[] $suggestions
     */
    public function updateStatus(
        int $type,
        int|string $relationId,
        GeneratedSuggestionStatus $status,
        array $suggestions = [],
    ): void {
        $this->generatedSuggestionRepository->updateStatus($type, $relationId, $status, $suggestions);
    }
}
