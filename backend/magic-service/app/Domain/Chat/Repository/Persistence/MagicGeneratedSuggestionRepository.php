<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\Entity\MagicGeneratedSuggestionEntity;
use App\Domain\Chat\Entity\ValueObject\GeneratedSuggestionStatus;
use App\Domain\Chat\Repository\Facade\MagicGeneratedSuggestionRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\Model\MagicGeneratedSuggestionModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class MagicGeneratedSuggestionRepository implements MagicGeneratedSuggestionRepositoryInterface
{
    public function __construct(
        private readonly MagicGeneratedSuggestionModel $model,
    ) {
    }

    public function createGenerating(
        int $type,
        int|string $relationId,
        array $params = [],
        null|int|string $createdUid = null,
    ): array {
        $relationId = $this->normalizeKey($relationId);

        $entity = $this->findLatestEntityByTypeAndRelationId($type, $relationId);
        if ($entity !== null) {
            return $entity->toArray();
        }

        $now = date('Y-m-d H:i:s');
        $record = $this->model::query()->create([
            'id' => IdGenerator::getSnowId(),
            'type' => $type,
            'relation_id' => $relationId,
            'params' => $params === [] ? null : $params,
            'suggestions' => null,
            'status' => GeneratedSuggestionStatus::Generating->value,
            'created_uid' => $this->normalizeNullableKey($createdUid),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return $record->toArray();
    }

    public function findLatestEntityByTypeAndRelationId(int $type, int|string $relationId): ?MagicGeneratedSuggestionEntity
    {
        $record = $this->model::query()
            ->where('type', $type)
            ->where('relation_id', $this->normalizeKey($relationId))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();

        return $record === null ? null : $this->mapModelToEntity($record);
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
        $record = $this->model::query()
            ->where('type', $type)
            ->where('relation_id', $this->normalizeKey($relationId))
            ->first();
        if ($record === null) {
            return;
        }

        $record->status = $status->value;
        $record->updated_at = date('Y-m-d H:i:s');
        if ($status === GeneratedSuggestionStatus::Done) {
            $record->suggestions = array_values($suggestions);
        }
        $record->save();
    }

    private function normalizeKey(null|int|string $value): string
    {
        if ($value === null) {
            return '';
        }

        return (string) $value;
    }

    private function normalizeNullableKey(null|int|string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (string) $value;
    }

    private function mapModelToEntity(MagicGeneratedSuggestionModel $record): MagicGeneratedSuggestionEntity
    {
        $entity = new MagicGeneratedSuggestionEntity();
        $entity->setId($record->id);
        $entity->setType((int) $record->type);
        $entity->setRelationId((string) $record->relation_id);
        $entity->setParams($record->params ?? []);
        $entity->setSuggestions($record->suggestions ?? []);
        $entity->setStatus($record->status !== null ? (int) $record->status : null);
        $entity->setCreatedUid($record->created_uid);
        $entity->setCreatedAt($record->created_at ?? '');
        $entity->setUpdatedAt($record->updated_at ?? '');

        return $entity;
    }
}
