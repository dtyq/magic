<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\EmbeddingGenerator;

use function Hyperf\Config\config;

class EmbeddingGenerator
{
    public static function defaultModel(): string
    {
        return config('magic_flows.default_embedding_model');
    }
}
