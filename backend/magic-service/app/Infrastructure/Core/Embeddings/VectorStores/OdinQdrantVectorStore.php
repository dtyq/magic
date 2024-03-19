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
    private Collections $collections;

    private Points $points;

    public function __construct()
    {
        $httpClient = new OdinQdrantHttpClient();
        $this->collections = new Collections($httpClient);
        $this->points = new Points($httpClient);
    }

    public function createCollection(string $name, int $vectorSize = 1536): bool
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

    public function storePoint(string $collectionName, string $pointId, array $embeddings, array $payload): void
    {
        $collection = $this->getCollection($collectionName);
        if (! $collection) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, "Collection [{$collectionName}] not found");
        }
        if ($collection->vectorSize !== count($embeddings)) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, '嵌入模型与向量库的长度不一致');
        }

        $pointId = new ExtendedPointId($pointId);
        $point = new PointStruct($pointId, new VectorStruct($embeddings), $payload);
        $this->points->setWait(true);
        $this->points->upsertPoints($collectionName, [$point]);
    }

    public function removePoint(string $collectionName, string $pointId): void
    {
        $this->points->deletePoints($collectionName, new ExtendedPointIds([$pointId]));
    }

    public function removePoints(string $collectionName, array $pointIds): void
    {
        if (empty($pointIds)) {
            return;
        }
        $this->points->deletePoints($collectionName, new ExtendedPointIds($pointIds));
    }

    public function removeByFilter(string $collectionName, array $payloadFilter): void
    {
        if (empty($payloadFilter)) {
            return;
        }
        $filter = $this->getFilter($payloadFilter);
        $this->points->deletePointsBuFilter($collectionName, $filter);
    }

    public function searchPoints(string $collectionName, array $queryEmbeddings, int $limit = 5, float $score = 0.4, array $payloadFilter = []): array
    {
        $filter = $this->getFilter($payloadFilter);

        $vector = new VectorStruct($queryEmbeddings);
        $result = $this->points->searchPoints(
            collectionName: $collectionName,
            vector: $vector,
            limit: $limit,
            filter: $filter,
            withPayload: new WithPayload(true)
        );
        $result = array_map(function (ScoredPoint $scoredPoint, int $key) use ($score) {
            if ($scoredPoint->score > $score) {
                return new PointInfo(
                    (string) $scoredPoint->id->id,
                    (string) $scoredPoint->version,
                    $scoredPoint->score,
                    $scoredPoint->payload,
                    $scoredPoint->vector->vector ?? [],
                );
            }
            return null;
        }, $result, array_keys($result));
        return array_filter($result);
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

    private function getFilter(array $payloadFilter = []): ?Filter
    {
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
}
