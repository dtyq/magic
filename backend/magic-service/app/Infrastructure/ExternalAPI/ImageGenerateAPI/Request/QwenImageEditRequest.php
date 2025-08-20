<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request;

class QwenImageEditRequest extends ImageGenerateRequest
{
    protected array $imageUrls = [];

    public function __construct(
        string $prompt = '',
        array $imageUrls = [],
        string $model = 'qwen-image-edit',
    ) {
        parent::__construct('', '', $prompt, '', $model);
        $this->imageUrls = $imageUrls;
    }

    public function getImageUrls(): array
    {
        return $this->imageUrls;
    }

    public function setImageUrls(array $imageUrls): void
    {
        $this->imageUrls = $imageUrls;
    }

    public function toArray(): array
    {
        return [
            'prompt' => $this->getPrompt(),
            'image_urls' => $this->imageUrls,
            'model' => $this->getModel(),
        ];
    }
}
