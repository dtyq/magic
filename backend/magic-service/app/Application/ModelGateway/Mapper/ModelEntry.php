<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageModel;

/**
 * 统一模型容器，持有显示属性和执行实现（LLM/Embedding 用 OdinModel，图片生成用 ImageModel）.
 */
readonly class ModelEntry
{
    public function __construct(
        private ModelAttributes $attributes,
        private OdinModel|ImageModel $model,
    ) {
    }

    public function getKey(): string
    {
        return $this->attributes->getKey();
    }

    public function getAttributes(): ModelAttributes
    {
        return $this->attributes;
    }

    public function getModel(): OdinModel|ImageModel
    {
        return $this->model;
    }

    public function isImageModel(): bool
    {
        return $this->model instanceof ImageModel;
    }

    public function getOdinModel(): ?OdinModel
    {
        return $this->model instanceof OdinModel ? $this->model : null;
    }

    public function getImageModel(): ?ImageModel
    {
        return $this->model instanceof ImageModel ? $this->model : null;
    }
}
