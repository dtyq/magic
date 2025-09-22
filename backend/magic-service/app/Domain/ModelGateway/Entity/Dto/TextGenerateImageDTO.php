<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;

class TextGenerateImageDTO extends AbstractRequestDTO
{
    protected string $prompt = '';

    protected string $size = '1024x1024';

    protected int $n = 1;

    protected array $images = [];

    protected ?WatermarkConfig $watermark = null;

    protected string $sequentialImageGeneration = 'disabled';

    protected array $sequentialImageGenerationOptions = [];

    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function setPrompt(string $prompt): void
    {
        $this->prompt = $prompt;
    }

    public function getSize(): string
    {
        return $this->size;
    }

    public function setSize(string $size): void
    {
        $this->size = $size;
    }

    public function getN(): int
    {
        return $this->n;
    }

    public function setN(int $n): void
    {
        $this->n = $n;
    }

    public function getType(): string
    {
        return 'image';
    }

    public function valid()
    {
        if ($this->model === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'model_field']);
        }

        if ($this->size === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'size_field']);
        }

        if ($this->n < 1 || $this->n > 4) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.invalid_range', ['label' => 'Number of images', 'min' => 1, 'max' => 4]);
        }

        if ($this->prompt === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'prompt_field']);
        }
    }

    public function getWatermark(): ?WatermarkConfig
    {
        return $this->watermark;
    }

    public function setWatermark(null|array|WatermarkConfig $watermark): void
    {
        if (is_array($watermark)) {
            $watermark = new WatermarkConfig($watermark['logo_text_content'] ?? '', $watermark['position'] ?? 3, $watermark['opacity'] ?? 0.3);
        }

        $this->watermark = $watermark;
    }

    public function validateSupportedImageEditModel(): bool
    {
        $supportedModels = array_merge(
            ImageGenerateModelType::getVolcengineModes(),
            ImageGenerateModelType::getAzureOpenAIEditModes(),
            ImageGenerateModelType::getQwenImageEditModes(),
            ImageGenerateModelType::getGoogleGeminiModes(),
            ImageGenerateModelType::getVolcengineArkModes()
        );

        if (! in_array($this->model, $supportedModels)) {
            return false;
        }
        return true;
    }

    public function getSequentialImageGeneration(): string
    {
        return $this->sequentialImageGeneration;
    }

    public function setSequentialImageGeneration(string $sequentialImageGeneration): void
    {
        $this->sequentialImageGeneration = $sequentialImageGeneration;
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
