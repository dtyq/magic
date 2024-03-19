<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request;

class QwenImageModelRequest extends ImageGenerateRequest
{
    protected array $referImages = [];

    protected bool $promptExtend = true;

    protected bool $watermark = true;

    public function __construct(
        string $width = '',
        string $height = '',
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

    public function getReferImages(): array
    {
        return $this->referImages;
    }

    public function setReferImages(array $referImages): void
    {
        $this->referImages = $referImages;
    }

    public function toArray(?int $n = null): array
    {
        $generateNum = $n ?? $this->getGenerateNum();
        if ($generateNum < 1) {
            $generateNum = 1;
        }

        $content = [];
        foreach ($this->getReferImages() as $imageUrl) {
            if (! empty($imageUrl)) {
                $content[] = [
                    'image' => $imageUrl,
                ];
            }
        }

        if ($this->getPrompt() !== '') {
            $content[] = [
                'text' => $this->getPrompt(),
            ];
        }

        $parameters = [
            'n' => $generateNum,
            'negative_prompt' => $this->getNegativePrompt(),
            'prompt_extend' => $this->isPromptExtend(),
            'watermark' => $this->isWatermark(),
        ];

        if (! empty($this->getWidth()) && ! empty($this->getHeight())) {
            $parameters['size'] = $this->getWidth() . '*' . $this->getHeight();
        }

        $payload = [
            'model' => $this->getModel(),
            'input' => [
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => $content,
                    ],
                ],
            ],
            'parameters' => $parameters,
        ];

        $payload['parameters'] = array_filter(
            $payload['parameters'],
            static fn ($value) => ! empty($value)
        );

        return $payload;
    }
}
