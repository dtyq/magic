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

    /**
     * 保存沙箱上报的追加问题状态。
     *
     * @param string[] $suggestions
     * @param array<string, string> $params
     */
    public function saveReport(
        int $type,
        string $relationId,
        GeneratedSuggestionStatus $status,
        array $suggestions,
        ?string $createdUid,
        array $params,
    ): MagicGeneratedSuggestionEntity {
        return $this->generatedSuggestionRepository->saveReport(
            $type,
            $relationId,
            $status,
            $suggestions,
            $createdUid,
            $params,
        );
    }
}
