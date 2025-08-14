<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request;

class QwenImageModelRequest extends ImageGenerateRequest
{
    protected string $size = '1328*1328';

    protected ?string $promptExtend = null;

    protected ?string $watermark = null;

    protected string $organizationCode = '';

    public function __construct(
        string $width = '1328',
        string $height = '1328',
        string $prompt = '',
        string $negativePrompt = '',
        string $model = 'qwen-image',
    ) {
        parent::__construct($width, $height, $prompt, $negativePrompt, $model);
        $this->size = $width . '*' . $height;
    }

    public function getSize(): string
    {
        return $this->size;
    }

    public function setSize(string $size): void
    {
        $this->size = $size;
        // 同步更新宽高
        $dimensions = explode('*', $size);
        if (count($dimensions) === 2) {
            $this->width = $dimensions[0];
            $this->height = $dimensions[1];
        }
    }

    public function getPromptExtend(): ?string
    {
        return $this->promptExtend;
    }

    public function setPromptExtend(?string $promptExtend): void
    {
        $this->promptExtend = $promptExtend;
    }

    public function getWatermark(): ?string
    {
        return $this->watermark;
    }

    public function setWatermark(?string $watermark): void
    {
        $this->watermark = $watermark;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }
}
