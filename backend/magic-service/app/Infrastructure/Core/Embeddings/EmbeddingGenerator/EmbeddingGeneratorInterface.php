<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\EmbeddingGenerator;

use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Hyperf\Odin\Contract\Model\EmbeddingInterface;

interface EmbeddingGeneratorInterface
{
    public function getDefaultModel(BaseDataIsolation $dataIsolation): EmbeddingInterface;

    /**
     * @return array<float>
     */
    public function embedText(
        EmbeddingInterface $embeddingModel,
        string $text,
        array $options = [],
    ): array;
}
