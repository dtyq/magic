<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\VolcengineArk;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;

class VolcengineArkRequest extends ImageGenerateRequest
{
    protected string $responseFormat = 'url';

    protected bool $watermark = false;

    protected string $sequentialImageGeneration = 'disabled';

    protected bool $stream = false;

    protected array $referImages = [];

    protected array $sequentialImageGenerationOptions = [];

    public function getResponseFormat(): string
    {
        return $this->responseFormat;
    }

    public function setResponseFormat(string $responseFormat): void
    {
        $this->responseFormat = $responseFormat;
    }

    public function getWatermark(): bool
    {
        return $this->watermark;
    }

    public function setWatermark(bool $watermark): void
    {
        $this->watermark = $watermark;
    }

    public function getSequentialImageGeneration(): string
    {
        return $this->sequentialImageGeneration;
    }

    public function setSequentialImageGeneration(string $sequentialImageGeneration): void
    {
        $this->sequentialImageGeneration = $sequentialImageGeneration;
    }

    public function getStream(): bool
    {
        return $this->stream;
    }

    public function setStream(bool $stream): void
    {
        $this->stream = $stream;
    }

    public function getReferImages(): array
    {
        return $this->referImages;
    }

    public function setReferImages(array $referImages): void
    {
        $this->referImages = $referImages;
    }

    public function getSequentialImageGenerationOptions(): array
    {
        return $this->sequentialImageGenerationOptions;
    }

    public function setSequentialImageGenerationOptions(array $sequentialImageGenerationOptions): void
    {
        $this->sequentialImageGenerationOptions = $sequentialImageGenerationOptions;
    }
}
