<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\VectorStores;

readonly class CollectionInfo
{
    public function __construct(
        public string $name,
        public int $vectorsCount,
        public int $pointsCount,
        public int $vectorSize,
    ) {
    }
}
