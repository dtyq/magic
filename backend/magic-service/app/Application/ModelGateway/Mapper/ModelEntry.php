<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageModel;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoModel;

/**
 * 统一模型容器，持有显示属性和执行实现（LLM/Embedding 用 OdinModel，图片生成用 ImageModel，视频生成用 VideoModel）.
 */
readonly class ModelEntry
{
    public function __construct(
        private ModelAttributes $attributes,
        private ImageModel|OdinModel|VideoModel $model,
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

    public function getModel(): ImageModel|OdinModel|VideoModel
    {
        return $this->model;
    }

    public function isImageModel(): bool
    {
        return $this->model instanceof ImageModel;
    }

    public function isVideoModel(): bool
    {
        return $this->model instanceof VideoModel;
    }

    public function getOdinModel(): ?OdinModel
    {
        return $this->model instanceof OdinModel ? $this->model : null;
    }

    public function getImageModel(): ?ImageModel
    {
        return $this->model instanceof ImageModel ? $this->model : null;
    }

    public function getVideoModel(): ?VideoModel
    {
        return $this->model instanceof VideoModel ? $this->model : null;
    }
}
