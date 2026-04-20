<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;

class GoogleGeminiRequest extends ImageGenerateRequest
{
    protected float $temperature = 0.7;

    protected int $candidateCount = 1;

    protected int $maxOutputTokens = 32768;

    protected float $topP = 0.95;

    protected array $responseModalities = ['TEXT', 'IMAGE'];

    protected array $referImages = [];

    /**
     * 分辨率预设：支持 1K, 2K, 4K（短边像素数）
     * 用于 Nano Banana / Nano Banana Pro 模型.
     */
    protected ?string $resolutionPreset = null;

    public function getTemperature(): float
    {
        return $this->temperature;
    }

    public function setTemperature(float $temperature): void
    {
        $this->temperature = $temperature;
    }

    public function getCandidateCount(): int
    {
        return $this->candidateCount;
    }

    public function setCandidateCount(int $candidateCount): void
    {
        $this->candidateCount = $candidateCount;
    }

    public function getMaxOutputTokens(): int
    {
        return $this->maxOutputTokens;
    }

    public function setMaxOutputTokens(int $maxOutputTokens): void
    {
        $this->maxOutputTokens = $maxOutputTokens;
    }

    public function getTopP(): float
    {
        return $this->topP;
    }

    public function setTopP(float $topP): void
    {
        $this->topP = $topP;
    }

    public function getResponseModalities(): array
    {
        return $this->responseModalities;
    }

    public function setResponseModalities(array $responseModalities): void
    {
        $this->responseModalities = $responseModalities;
    }

    public function getReferImages(): array
    {
        return $this->referImages;
    }

    public function setReferImages(array $referImages): void
    {
        $this->referImages = $referImages;
    }

    public function getResolutionPreset(): ?string
    {
        return $this->resolutionPreset;
    }

    public function setResolutionPreset(?string $resolutionPreset): void
    {
        $this->resolutionPreset = $resolutionPreset;
    }

    public function getGenerationConfig(): array
    {
        $config = [
            'temperature' => $this->temperature,
            'candidateCount' => $this->candidateCount,
            'maxOutputTokens' => $this->maxOutputTokens,
            'topP' => $this->topP,
            'responseModalities' => $this->responseModalities,
        ];

        // 构建 image_config（直接使用 snake_case 格式，供 API 层直接使用）
        $imageConfig = [];

        if (! empty($this->getRatio())) {
            $imageConfig['aspectRatio'] = $this->getRatio();
        }

        // 分辨率预设：1k，2k，4k
        // gemini-2.5-flash-image-preview 支持 1k
        // gemini-3-pro-image-preview 支持 1k，2k，4k
        if (! empty($this->getResolutionPreset())) {
            $preset = $this->getResolutionPreset();
            // 如果配置的是 4X, 2X 这种格式，转换为 4K, 2K
            // Nano Banana (Gemini) 模型 API 接受的参数格式为 "1K", "2K", "4K"
            $preset = str_replace('X', 'K', $preset);
            $preset = str_replace('x', 'K', $preset);
            $preset = str_replace('k', 'K', $preset);
            $imageConfig['imageSize'] = $preset;
        }

        // 如果有 image_config 参数，添加到配置中
        if (! empty($imageConfig)) {
            $config['imageConfig'] = $imageConfig;
        }

        return $config;
    }
}
