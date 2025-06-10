<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request;

class AzureOpenAIImageEditRequest extends ImageGenerateRequest
{
    private array $imageUrls;

    private ?string $maskUrl = null;

    private string $size = '1024x1024';

    private int $n = 1;

    public function setImageUrls(array $imageUrls): void
    {
        $this->imageUrls = $imageUrls;
    }

    public function getImageUrls(): array
    {
        return $this->imageUrls;
    }

    public function setMaskUrl(?string $maskUrl): void
    {
        $this->maskUrl = $maskUrl;
    }

    public function getMaskUrl(): ?string
    {
        return $this->maskUrl;
    }

    public function setSize(string $size): void
    {
        $this->size = $size;
    }

    public function getSize(): string
    {
        return $this->size;
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
            'image_urls' => $this->imageUrls,
            'mask_url' => $this->maskUrl,
            'size' => $this->size,
            'n' => $this->n,
        ];
    }
}
