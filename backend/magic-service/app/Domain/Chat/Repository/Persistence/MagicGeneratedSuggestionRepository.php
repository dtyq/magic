<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\Repository\Persistence\Model\MagicGeneratedSuggestionModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class MagicGeneratedSuggestionRepository
{
    public const STATUS_GENERATING = 0;

    public const STATUS_DONE = 1;

    public const STATUS_FAILED = 2;

    public function __construct(
        private readonly MagicGeneratedSuggestionModel $model,
    ) {
    }

    public function createGenerating(
        int $type,
        string|int $relationKey1,
        null|int|string $relationKey2 = '',
        null|int|string $relationKey3 = '',
        array $params = [],
        null|int|string $createdUid = null,
    ): array {
        $relationKey1 = $this->normalizeKey($relationKey1);
        $relationKey2 = $this->normalizeKey($relationKey2);
        $relationKey3 = $this->normalizeKey($relationKey3);

        $record = $this->findLatestByRelationKeys($type, $relationKey1, $relationKey2, $relationKey3);
        if ($record !== null) {
            return $record;
        }

        $now = date('Y-m-d H:i:s');
        $record = $this->model::query()->create([
            'id' => IdGenerator::getSnowId(),
            'type' => $type,
            'relation_key1' => $relationKey1,
            'relation_key2' => $relationKey2,
            'relation_key3' => $relationKey3,
            'params' => $params === [] ? null : $params,
            'suggestions' => null,
            'status' => self::STATUS_GENERATING,
            'created_uid' => $this->normalizeNullableKey($createdUid),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return $record->toArray();
    }

    public function findLatestByTypeAndRelationKey1(int $type, string|int $relationKey1): ?array
    {
        $record = $this->model::query()
            ->where('type', $type)
            ->where('relation_key1', $this->normalizeKey($relationKey1))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();

        return $record?->toArray();
    }

    public function findLatestByRelationKeys(
        int $type,
        string|int $relationKey1,
        null|int|string $relationKey2 = '',
        null|int|string $relationKey3 = '',
    ): ?array {
        $record = $this->model::query()
            ->where('type', $type)
            ->where('relation_key1', $this->normalizeKey($relationKey1))
            ->where('relation_key2', $this->normalizeKey($relationKey2))
            ->where('relation_key3', $this->normalizeKey($relationKey3))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();

        return $record?->toArray();
    }

    /**
     * @param string[] $suggestions
     */
    public function markDone(
        int $type,
        string|int $relationKey1,
        null|int|string $relationKey2 = '',
        null|int|string $relationKey3 = '',
        array $suggestions = [],
    ): void {
        $record = $this->model::query()
            ->where('type', $type)
            ->where('relation_key1', $this->normalizeKey($relationKey1))
            ->where('relation_key2', $this->normalizeKey($relationKey2))
            ->where('relation_key3', $this->normalizeKey($relationKey3))
            ->first();
        if ($record === null) {
            return;
        }

        $record->suggestions = array_values($suggestions);
        $record->status = self::STATUS_DONE;
        $record->updated_at = date('Y-m-d H:i:s');
        $record->save();
    }

    public function markFailed(
        int $type,
        string|int $relationKey1,
        null|int|string $relationKey2 = '',
        null|int|string $relationKey3 = '',
    ): void {
        $this->model::query()
            ->where('type', $type)
            ->where('relation_key1', $this->normalizeKey($relationKey1))
            ->where('relation_key2', $this->normalizeKey($relationKey2))
            ->where('relation_key3', $this->normalizeKey($relationKey3))
            ->update([
                'status' => self::STATUS_FAILED,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
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
}
