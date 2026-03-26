<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Domain\Chat\Entity\ValueObject\GeneratedSuggestionStatus;
use App\Domain\Chat\Entity\ValueObject\GeneratedSuggestionType;
use App\Domain\Chat\Repository\Facade\MagicGeneratedSuggestionRepositoryInterface;

class MagicGeneratedSuggestionDomainService
{
    public function __construct(
        private readonly MagicGeneratedSuggestionRepositoryInterface $generatedSuggestionRepository,
    ) {
    }

    public function queryByRelationId(int $type, string $relationId): array
    {
        $record = $this->generatedSuggestionRepository->findLatestByTypeAndRelationId(
            $type,
            $relationId,
        );

        if ($record === null) {
            return [
                'type' => $type,
                'type_label' => GeneratedSuggestionType::label($type),
                'relation_id' => $relationId,
                'params' => [],
                'task_id' => $relationId,
                'topic_id' => null,
                'status' => null,
                'suggestions' => [],
                'updated_at' => '',
            ];
        }

        return [
            'type' => (int) ($record['type'] ?? $type),
            'type_label' => GeneratedSuggestionType::label((int) ($record['type'] ?? $type)),
            'relation_id' => (string) ($record['relation_id'] ?? $relationId),
            'params' => $record['params'] ?? [],
            'task_id' => (string) ($record['relation_id'] ?? $relationId),
            'topic_id' => isset($record['params']['topic_id']) ? (int) $record['params']['topic_id'] : null,
            'status' => (int) ($record['status'] ?? GeneratedSuggestionStatus::Generating->value),
            'suggestions' => array_values($record['suggestions'] ?? []),
            'updated_at' => $record['updated_at'] ?? '',
        ];
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
