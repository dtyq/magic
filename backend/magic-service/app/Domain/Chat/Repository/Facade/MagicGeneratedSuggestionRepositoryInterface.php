<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Facade;

use App\Domain\Chat\Entity\MagicGeneratedSuggestionEntity;
use App\Domain\Chat\Entity\ValueObject\GeneratedSuggestionStatus;

interface MagicGeneratedSuggestionRepositoryInterface
{
    public function createGenerating(
        int $type,
        int|string $relationId,
        array $params = [],
        null|int|string $createdUid = null,
    ): array;

    public function findLatestEntityByTypeAndRelationId(int $type, int|string $relationId): ?MagicGeneratedSuggestionEntity;

    /**
     * @param string[] $suggestions
     */
    public function updateStatus(
        int $type,
        int|string $relationId,
        GeneratedSuggestionStatus $status,
        array $suggestions = [],
        array $params = [],
    ): void;
}
