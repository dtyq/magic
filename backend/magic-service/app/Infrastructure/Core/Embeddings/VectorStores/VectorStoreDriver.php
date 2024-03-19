<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\VectorStores;

use Hyperf\Context\ApplicationContext;

enum VectorStoreDriver: string
{
    case OdinQdrant = 'odin_qdrant';

    public function get(): VectorStoreInterface
    {
        return match ($this) {
            VectorStoreDriver::OdinQdrant => ApplicationContext::getContainer()->get(OdinQdrantVectorStore::class),
        };
    }

    public static function default(): VectorStoreDriver
    {
        return VectorStoreDriver::OdinQdrant;
    }
}
