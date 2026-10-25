<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\VectorStores;

interface VectorStoreInterface
{
    public function createCollection(string $name, int $vectorSize): bool;

    public function getCollection(string $name): ?CollectionInfo;

    public function removeCollection(string $name): bool;

    /** Return one vector point and its payload by stable point ID. */
    public function getPoint(string $collectionName, string $pointId): ?PointInfo;

    /**
     * @param array<float> $embeddings
     */
    public function storePoint(string $collectionName, string $pointId, array $embeddings, array $payload): void;

    public function removePoint(string $collectionName, string $pointId): void;

    public function removePoints(string $collectionName, array $pointIds): void;

    public function removeByFilter(string $collectionName, array $payloadFilter): void;

    /** Update filterable payload fields without recalculating the stored vector. */
    public function updatePayload(string $collectionName, string $pointId, array $payload): void;

    /**
     * Search vectors with optional payload filters and offset pagination.
     *
     * @return array<PointInfo>
     */
    public function searchPoints(
        string $collectionName,
        array $queryEmbeddings,
        int $limit = 5,
        float $score = 0.4,
        array $payloadFilter = [],
        int $offset = 0
    ): array;

    /**
     * @return array<PointInfo>
     */
    public function queryPoints(string $collectionName, int $limit = 10, array $payloadFilter = []): array;

    /** @return array{points: PointInfo[], next_page_offset: null|int|string} */
    public function scrollPoints(string $collectionName, int $limit = 100, ?string $offset = null): array;
}
