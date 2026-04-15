<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request;

use App\Domain\ImageGenerate\ValueObject\ImplicitWatermark;
use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;

class ImageGenerateRequest
{
    // 图片宽度（像素）
    protected string $width;

    // 图片高度（像素）
    protected string $height;

    // 图片尺寸，格式如 "1024x1024", "1920x1080" 等
    protected string $size = '1024x1024';

    // 宽高比，格式如 "16:9", "1:1", "3:4" 等
    protected string $ratio = '1:1';

    // 提示词（用户输入的图片生成描述）
    protected string $prompt;

    // 负面提示词（不希望出现在图片中的内容）
    protected string $negativePrompt;

    protected string $defaultNegativePrompt = '--no nsfw, nude, blurry, watermark, identifying mark, low resolution, mutated, lack of hierarchy';

    // 对mj无效
    protected int $generateNum = 1;

    protected string $model;

    // 显示水印
    protected ?WatermarkConfig $watermarkConfig = null;

    // 隐式水印
    protected ?ImplicitWatermark $implicitWatermark = null;

    // 有效期
    protected ?int $validityPeriod = null;

    // 用户ID（用于PGP签名）
    protected ?string $userId = null;

    // 组织编码（用于PGP签名）
    protected ?string $organizationCode = null;

    // 输出图片格式（统一使用小写格式，如 png、jpeg、webp 等；空字符串表示使用服务商默认格式）
    protected string $outputFormat = '';

    public function __construct(
        string $width = '',
        string $height = '',
        string $prompt = '',
        string $negativePrompt = '',
        string $model = '',
    ) {
        $this->width = $width;
        $this->height = $height;
        $this->prompt = $prompt;
        $this->negativePrompt = $negativePrompt;
        $this->model = $model;
    }

    public function getWidth(): string
    {
        return $this->width;
    }

    public function setWidth(string $width): void
    {
        $this->width = $width;
    }

    public function getHeight(): string
    {
        return $this->height;
    }

    public function setHeight(string $height): void
    {
        $this->height = $height;
    }

    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function setPrompt(string $prompt): void
    {
        $this->prompt = $prompt;
    }

    public function getNegativePrompt(): string
    {
        return $this->negativePrompt;
    }

    public function setNegativePrompt(string $negativePrompt): void
    {
        $this->negativePrompt = $negativePrompt;
    }

    public function getDefaultNegativePrompt(): string
    {
        return $this->defaultNegativePrompt;
    }

    public function setGenerateNum(int $generateNum): void
    {
        $this->generateNum = $generateNum;
    }

    public function getGenerateNum(): int
    {
        return $this->generateNum;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(string $model): void
    {
        $this->model = $model;
    }

    public function getWatermarkConfig(): ?WatermarkConfig
    {
        return $this->watermarkConfig;
    }

    public function setWatermarkConfig(?WatermarkConfig $watermarkConfig): void
    {
        $this->watermarkConfig = $watermarkConfig;
    }

    public function getImplicitWatermark(): ?ImplicitWatermark
    {
        return $this->implicitWatermark;
    }

    public function setImplicitWatermark(?ImplicitWatermark $implicitWatermark): void
    {
        $this->implicitWatermark = $implicitWatermark;
    }

    public function getValidityPeriod(): ?int
    {
        return $this->validityPeriod;
    }

    public function setValidityPeriod(?int $validityPeriod): void
    {
        $this->validityPeriod = $validityPeriod;
    }

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function setUserId(?string $userId): void
    {
        $this->userId = $userId;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function isAddWatermark(): bool
    {
        return $this->getWatermarkConfig() !== null;
    }

    public function getSize(): string
    {
        return $this->size;
    }

    public function setSize(string $size): void
    {
        $this->size = $size;
    }

    public function getRatio(): string
    {
        return $this->ratio;
    }

    public function setRatio(string $ratio): void
    {
        $this->ratio = $ratio;
    }

    public function getOutputFormat(): string
    {
        return $this->outputFormat;
    }

    public function setOutputFormat(string $outputFormat): void
    {
        $this->outputFormat = $outputFormat;
    }
}
