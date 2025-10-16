<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request;

class VolcengineModelV4Request extends VolcengineModelRequest
{
    private ?float $scale = null;

    private ?bool $forceSingle = null;

    private ?float $minRatio = null;

    private ?float $maxRatio = null;

    public function __construct(string $width = '512', string $height = '512', string $prompt = '', string $negativePrompt = '')
    {
        parent::__construct($width, $height, $prompt, $negativePrompt);
    }

    public function getScale(): ?float
    {
        return $this->scale;
    }

    public function setScale(?float $scale): void
    {
        $this->scale = $scale;
    }

    public function getForceSingle(): ?bool
    {
        return $this->forceSingle;
    }

    public function setForceSingle(?bool $forceSingle): void
    {
        $this->forceSingle = $forceSingle;
    }

    public function getMinRatio(): ?float
    {
        return $this->minRatio;
    }

    public function setMinRatio(?float $minRatio): void
    {
        $this->minRatio = $minRatio;
    }

    public function getMaxRatio(): ?float
    {
        return $this->maxRatio;
    }

    public function setMaxRatio(?float $maxRatio): void
    {
        $this->maxRatio = $maxRatio;
    }

    public function toRequestParams(): array
    {
        $prompt = $this->getPrompt();
        $width = (int) $this->getWidth();
        $height = (int) $this->getHeight();

        $body = [
            'prompt' => $prompt,
            'width' => $width,
            'height' => $height,
            'req_key' => $this->getModel(),
        ];

        if ($this->getReferenceImage()) {
            $body['image_urls'] = $this->getReferenceImage();
        }
        if ($this->getScale() !== null) {
            $body['scale'] = $this->getScale();
        }
        if ($this->getForceSingle() !== null) {
            $body['force_single'] = $this->getForceSingle();
        }
        if ($this->getMinRatio() !== null) {
            $body['min_ratio'] = $this->getMinRatio();
        }
        if ($this->getMaxRatio() !== null) {
            $body['max_ratio'] = $this->getMaxRatio();
        }
        return $body;
    }
}
