<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\VectorStores;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use GuzzleHttp\Exception\ClientException;
use Hyperf\Qdrant\Api\Collections;
use Hyperf\Qdrant\Struct\Collections\Enums\Distance;
use Hyperf\Qdrant\Struct\Collections\VectorParams;
use Hyperf\Qdrant\Struct\Points\ExtendedPointId;
use Hyperf\Qdrant\Struct\Points\ExtendedPointIds;
use Hyperf\Qdrant\Struct\Points\Point\PointStruct;
use Hyperf\Qdrant\Struct\Points\Point\Record;
use Hyperf\Qdrant\Struct\Points\Point\ScoredPoint;
use Hyperf\Qdrant\Struct\Points\SearchCondition\FieldCondition;
use Hyperf\Qdrant\Struct\Points\SearchCondition\Filter;
use Hyperf\Qdrant\Struct\Points\SearchCondition\Match\MatchAny;
use Hyperf\Qdrant\Struct\Points\SearchCondition\Match\MatchValue;
use Hyperf\Qdrant\Struct\Points\VectorStruct;
use Hyperf\Qdrant\Struct\Points\WithPayload;
use Throwable;

class OdinQdrantVectorStore implements VectorStoreInterface
{
    private OdinQdrantHttpClient $httpClient;

    private Collections $collections;

    private Points $points;

    public function __construct()
    {
        $this->httpClient = new OdinQdrantHttpClient();
        $this->collections = new Collections($this->httpClient);
        $this->points = new Points($this->httpClient);
    }

    public function createCollection(string $name, int $vectorSize): bool
    {
        return $this->collections->createCollection($name, new VectorParams($vectorSize, Distance::COSINE));
    }

    public function getCollection(string $name): ?CollectionInfo
    {
        try {
            $info = $this->collections->getCollectionInfo($name);
        } catch (Throwable $throwable) {
            if ($throwable instanceof ClientException && $throwable->getCode() === 404) {
                return null;
            }
            throw $throwable;
        }

        return new CollectionInfo(
            $info->name,
            $info->vectorsCount ?? 0,
            $info->pointsCount,
            $info->config->params->vectors->size
        );
    }

    public function removeCollection(string $name): bool
    {
        return $this->collections->deleteCollection($name);
    }

    /** Read one point so callers can decide whether its vector or payload needs updating. */
    public function getPoint(string $collectionName, string $pointId): ?PointInfo
    {
        try {
            $record = $this->points->getPoint($collectionName, new ExtendedPointId($this->toQdrantPointId($pointId)));
        } catch (Throwable $throwable) {
            if ($throwable instanceof ClientException && $throwable->getCode() === 404) {
                return null;
            }
            throw $throwable;
        }

        return new PointInfo(
            (string) $record->id->id,
            '',
            0,
            $record->payload ?? [],
            $record->vector->vector ?? [],
        );
    }

    public function storePoint(string $collectionName, string $pointId, array $embeddings, array $payload): void
    {
        $collection = $this->getCollection($collectionName);
        if (! $collection) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, "Collection [{$collectionName}] not found");
        }
        if ($collection->vectorSize !== count($embeddings)) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, '嵌入模型与向量库的长度不一致');
        }

        $pointId = new ExtendedPointId($this->toQdrantPointId($pointId));
        $point = new PointStruct($pointId, new VectorStruct($embeddings), $payload);
        $this->points->setWait(true);
        $this->points->upsertPoints($collectionName, [$point]);
    }

    public function removePoint(string $collectionName, string $pointId): void
    {
        $this->points->deletePoints($collectionName, new ExtendedPointIds([$this->toQdrantPointId($pointId)]));
    }

    public function removePoints(string $collectionName, array $pointIds): void
    {
        if (empty($pointIds)) {
            return;
        }
        $this->points->deletePoints(
            $collectionName,
            new ExtendedPointIds(array_map(fn (int|string $pointId): int|string => $this->toQdrantPointId($pointId), $pointIds)),
        );
    }

    public function removeByFilter(string $collectionName, array $payloadFilter): void
    {
        if (empty($payloadFilter)) {
            return;
        }
        $filter = $this->getFilter($payloadFilter);
        $this->points->deletePointsBuFilter($collectionName, $filter);
    }

    /** Update filter payload without changing the point's existing embedding vector. */
    public function updatePayload(string $collectionName, string $pointId, array $payload): void
    {
        $this->httpClient->request(
            'POST',
            sprintf('/collections/%s/points/payload?wait=true', rawurlencode($collectionName)),
            [
                'payload' => $payload,
                'points' => [$this->toQdrantPointId($pointId)],
            ],
        );
    }

    /** Search Qdrant with payload filters and offset-based pagination. */
    public function searchPoints(
        string $collectionName,
        array $queryEmbeddings,
        int $limit = 5,
        float $score = 0.4,
        array $payloadFilter = [],
        int $offset = 0
    ): array {
        $filter = $this->getFilter($payloadFilter);

        $vector = new VectorStruct($queryEmbeddings);
        $result = $this->points->searchPoints(
            collectionName: $collectionName,
            vector: $vector,
            limit: $limit,
            filter: $filter,
            offset: max(0, $offset),
            withPayload: new WithPayload(true),
            scoreThreshold: $score,
        );

        return array_map(static function (ScoredPoint $scoredPoint): PointInfo {
            return new PointInfo(
                (string) $scoredPoint->id->id,
                (string) $scoredPoint->version,
                $scoredPoint->score,
                $scoredPoint->payload,
                $scoredPoint->vector->vector ?? [],
            );
        }, $result);
    }

    public function queryPoints(string $collectionName, int $limit = 10, array $payloadFilter = []): array
    {
        $filter = $this->getFilter($payloadFilter);

        $result = $this->points->queryPoints($collectionName, $limit, $filter);
        return array_map(function (Record $record) {
            return new PointInfo(
                (string) $record->id->id,
                '',
                0,
                $record->payload,
                $record->vector->vector ?? [],
            );
        }, $result, array_keys($result));
    }

    public function scrollPoints(string $collectionName, int $limit = 100, ?string $offset = null): array
    {
        $result = $this->points->scrollPoints(
            collectionName: $collectionName,
            limit: max(1, $limit),
            offset: $offset === null ? null : new ExtendedPointId($this->toQdrantPointId($offset)),
        );

        return [
            'points' => array_map(
                static fn (Record $record): PointInfo => new PointInfo(
                    (string) $record->id->id,
                    '',
                    0,
                    $record->payload ?? [],
                    $record->vector->vector ?? [],
                ),
                $result['points'],
            ),
            'next_page_offset' => $result['next_page_offset'] === null
                ? null
                : (string) $result['next_page_offset'],
        ];
    }

    /**
     * Qdrant accepts numeric point IDs only as unsigned JSON integers; numeric strings are rejected.
     * Keep UUIDs as strings so this store remains compatible with non-numeric resources.
     */
    private function toQdrantPointId(int|string $pointId): int|string
    {
        $value = (string) $pointId;
        $maxInteger = (string) PHP_INT_MAX;
        $isSafeInteger = ctype_digit($value)
            && (strlen($value) < strlen($maxInteger)
                || (strlen($value) === strlen($maxInteger) && $value <= $maxInteger));

        return $isSafeInteger ? (int) $value : $value;
    }

    /** Support both legacy flat filters and the structured filters used by slides templates. */
    private function getFilter(array $payloadFilter = []): ?Filter
    {
        // Slides-template search uses the structured form so `all`, `any`, and
        // official/user visibility can be expressed without a second database filter.
        if (isset($payloadFilter['must']) || isset($payloadFilter['should']) || isset($payloadFilter['must_not'])) {
            return $this->buildStructuredFilter($payloadFilter);
        }

        $filter = null;
        if (! empty($payloadFilter)) {
            $must = [];
            foreach ($payloadFilter as $key => $value) {
                if (! is_string($key)) {
                    continue;
                }
                if (is_string($value) || is_numeric($value)) {
                    $must[] = new FieldCondition(key: $key, match: new MatchValue($value));
                }
                if (is_array($value)) {
                    $any = [];
                    foreach ($value as $item) {
                        if (is_string($item) || is_numeric($item)) {
                            $any[] = $item;
                        }
                    }
                    if (! empty($any)) {
                        $must[] = new FieldCondition(key: $key, match: new MatchAny($value));
                    }
                }
            }
            if (! empty($must)) {
                $filter = new Filter(
                    must: $must,
                );
            }
        }
        return $filter;
    }

    /** Convert nested must/should/must_not definitions into Qdrant SDK filters. */
    private function buildStructuredFilter(array $definition): ?Filter
    {
        $must = $this->buildConditions((array) ($definition['must'] ?? []));
        $should = $this->buildConditions((array) ($definition['should'] ?? []));
        $mustNot = $this->buildConditions((array) ($definition['must_not'] ?? []));
        if ($must === [] && $should === [] && $mustNot === []) {
            return null;
        }

        return new Filter(
            should: $should === [] ? null : $should,
            must: $must === [] ? null : $must,
            mustNot: $mustNot === [] ? null : $mustNot,
        );
    }

    /** Build scalar equality and MatchAny conditions, including nested groups. */
    private function buildConditions(array $definitions): array
    {
        $conditions = [];
        foreach ($definitions as $definition) {
            if (! is_array($definition)) {
                continue;
            }
            if (isset($definition['must']) || isset($definition['should']) || isset($definition['must_not'])) {
                $filter = $this->buildStructuredFilter($definition);
                if ($filter !== null) {
                    $conditions[] = $filter;
                }
                continue;
            }
            $key = $definition['key'] ?? null;
            if (! is_string($key) || $key === '') {
                continue;
            }
            if (array_key_exists('value', $definition) && (
                is_string($definition['value'])
                || is_numeric($definition['value'])
            )) {
                $conditions[] = new FieldCondition(key: $key, match: new MatchValue($definition['value']));
                continue;
            }
            $any = array_values(array_filter(
                (array) ($definition['any'] ?? []),
                static fn (mixed $value): bool => is_string($value) || is_numeric($value)
            ));
            if ($any !== []) {
                $conditions[] = new FieldCondition(key: $key, match: new MatchAny($any));
            }
        }
        return $conditions;
    }
}
