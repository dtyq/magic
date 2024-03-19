<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\VectorStores;

interface VectorStoreInterface
{
    public function createCollection(string $name, int $vectorSize = 1536): bool;

    public function getCollection(string $name): ?CollectionInfo;

    public function removeCollection(string $name): bool;

    /**
     * @param array<float> $embeddings
     */
    public function storePoint(string $collectionName, string $pointId, array $embeddings, array $payload): void;

    public function removePoint(string $collectionName, string $pointId): void;

    public function removePoints(string $collectionName, array $pointIds): void;

    public function removeByFilter(string $collectionName, array $payloadFilter): void;

    /**
     * @return array<PointInfo>
     */
    public function searchPoints(string $collectionName, array $queryEmbeddings, int $limit = 5, float $score = 0.4, array $payloadFilter = []): array;

    /**
     * @return array<PointInfo>
     */
    public function queryPoints(string $collectionName, int $limit = 10, array $payloadFilter = []): array;
}
