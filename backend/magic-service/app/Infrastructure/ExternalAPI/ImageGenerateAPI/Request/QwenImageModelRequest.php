<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request;

class QwenImageModelRequest extends ImageGenerateRequest
{
    protected bool $promptExtend = true;

    protected bool $watermark = true;

    public function __construct(
        string $width = '1328',
        string $height = '1328',
        string $prompt = '',
        string $negativePrompt = '',
        string $model = 'qwen-image',
    ) {
        parent::__construct($width, $height, $prompt, $negativePrompt, $model);
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function isPromptExtend(): bool
    {
        return $this->promptExtend;
    }

    public function setPromptExtend(bool $promptExtend): void
    {
        $this->promptExtend = $promptExtend;
    }

    public function isWatermark(): bool
    {
        return $this->watermark;
    }

    public function setWatermark(bool $watermark): void
    {
        $this->watermark = $watermark;
    }
}
