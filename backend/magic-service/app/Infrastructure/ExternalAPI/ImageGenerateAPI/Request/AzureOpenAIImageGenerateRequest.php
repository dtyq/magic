<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request;

class AzureOpenAIImageGenerateRequest extends ImageGenerateRequest
{
    private string $size = '1024x1024';

    private string $quality = 'medium';

    private int $n = 1;

    private array $referenceImages = [];

    public function getReferenceImages(): array
    {
        return $this->referenceImages;
    }

    public function setReferenceImages(array $referenceImages): void
    {
        $this->referenceImages = $referenceImages;
    }

    public function setSize(string $size): void
    {
        $this->size = $size;
    }

    public function getSize(): string
    {
        return $this->size;
    }

    public function setQuality(string $quality): void
    {
        $this->quality = $quality;
    }

    public function getQuality(): string
    {
        return $this->quality;
    }

    public function setN(int $n): void
    {
        $this->n = $n;
    }

    public function getN(): int
    {
        return $this->n;
    }

    public function toArray(): array
    {
        return [
            'prompt' => $this->getPrompt(),
            'size' => $this->size,
            'quality' => $this->quality,
            'n' => $this->n,
        ];
    }
}
