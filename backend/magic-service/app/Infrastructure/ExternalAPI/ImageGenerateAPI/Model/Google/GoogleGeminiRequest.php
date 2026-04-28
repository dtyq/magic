<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;

class GoogleGeminiRequest extends ImageGenerateRequest
{
    /**
     * 采样温度，控制生成随机性。
     * 值越高结果越发散；图片生成默认 0.7，兼顾稳定性和创造性。
     */
    protected float $temperature = 0.7;

    /**
     * 候选结果数量。
     * 当前图片生成链路按单张结果处理，默认只请求 1 个 candidate。
     */
    protected int $candidateCount = 1;

    /**
     * 最大输出 token 数。
     * Gemini 图片模型会同时返回文本/图片 part，保持较大上限避免复杂图像任务被截断。
     */
    protected int $maxOutputTokens = 32768;

    /**
     * nucleus sampling 参数，限制候选 token 的累计概率范围。
     * 默认 0.95，减少低概率噪声，同时保留一定创造性。
     */
    protected float $topP = 0.95;

    /**
     * 响应模态。
     * 图片生成需要同时允许 TEXT 和 IMAGE，Google 可能返回文本说明、思考 part 和最终图片 part。
     */
    protected array $responseModalities = ['TEXT', 'IMAGE'];

    /**
     * 是否让 Google 在响应中返回思考内容。
     * 默认为 false：请求侧不返回思考文本/思考图；响应侧仍会过滤 part.thought=true 作为兜底。
     */
    protected bool $includeThoughts = false;

    /**
     * 参考图片列表。
     * 有值时走图生图/图片编辑链路，会转换为 Gemini fileData 或 inlineData。
     */
    protected array $referImages = [];

    /**
     * 分辨率预设：支持 1K, 2K, 4K（短边像素数）
     * 用于 Nano Banana / Nano Banana Pro 模型.
     */
    protected ?string $resolutionPreset = null;

    public function __construct(
        string $width = '',
        string $height = '',
        string $prompt = '',
        string $negativePrompt = '',
        string $model = '',
    ) {
        parent::__construct($width, $height, $prompt, $negativePrompt, $model);
    }

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

    public function getIncludeThoughts(): bool
    {
        return $this->includeThoughts;
    }

    public function setIncludeThoughts(bool $includeThoughts): void
    {
        $this->includeThoughts = $includeThoughts;
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
            'thinkingConfig' => $this->getThinkingConfig(),
        ];

        // Vertex Gemini API uses camelCase fields in imageConfig.
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

    private function getThinkingConfig(): array
    {
        return [
            'includeThoughts' => $this->includeThoughts,
        ];
    }
}
