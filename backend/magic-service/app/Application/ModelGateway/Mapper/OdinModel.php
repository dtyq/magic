<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

use Hyperf\Odin\Contract\Model\EmbeddingInterface;
use Hyperf\Odin\Contract\Model\ModelInterface;

readonly class OdinModel
{
    public function __construct(
        private string $key,
        private EmbeddingInterface|ModelInterface $model,
        private OdinModelAttributes $attributes,
    ) {
    }

    public function getKey(): string
    {
        return $this->key;
    }

    public function getModel(): EmbeddingInterface|ModelInterface
    {
        return $this->model;
    }

    public function getAttributes(): OdinModelAttributes
    {
        return $this->attributes;
    }
}
