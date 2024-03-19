<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\VectorStores;

use Hyperf\Qdrant\Api\Points as QdrantPoints;
use Hyperf\Qdrant\Struct\Points\Point\Record;
use Hyperf\Qdrant\Struct\Points\SearchCondition\Filter;
use Hyperf\Qdrant\Struct\UpdateResult;

class Points extends QdrantPoints
{
    /**
     * @return Record[]
     */
    public function queryPoints(string $collectionName, int $limit = 5, ?Filter $filter = null): array
    {
        $params = [
            'limit' => $limit,
            'filter' => $filter,
        ];
        $result = $this->request('POST', "/collections/{$collectionName}/points/scroll", $params);
        return array_map(fn (array $item) => Record::fromArray($item), $result['points'] ?? []);
    }

    public function deletePointsBuFilter(string $collectionName, ?Filter $filter = null): UpdateResult
    {
        $result = $this->request('POST', "/collections/{$collectionName}/points/delete", ['filter' => $filter]);
        return UpdateResult::fromArray($result);
    }
}
