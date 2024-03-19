<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\EmbeddingGenerator;

use Hyperf\Odin\Contract\Model\EmbeddingInterface;

interface EmbeddingGeneratorInterface
{
    /**
     * @return array<float>
     */
    public function embedText(EmbeddingInterface $embeddingModel, string $text, array $options = []): array;
}
