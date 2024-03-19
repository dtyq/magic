<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\VectorStores;

readonly class PointInfo
{
    public function __construct(
        public string $id,
        public string $version,
        public float $score,
        public array $payload = [],
        public array $vector = []
    ) {
    }
}
