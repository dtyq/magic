<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Struct;

use App\Domain\ImageGenerate\ValueObject\ImplicitWatermark;
use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;

/**
 * 描述图片在进入通用处理管线后需要执行的后处理选项。
 * 这里只放“如何处理”，不放图片来源或运行时状态。
 */
final class ImagePostProcessOptions
{
    public function __construct(
        private ?WatermarkConfig $watermarkConfig = null,
        private ?ImplicitWatermark $implicitWatermark = null,
        private string $outputFormat = '',
    ) {
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

    public function getOutputFormat(): string
    {
        return $this->outputFormat;
    }

    public function setOutputFormat(string $outputFormat): void
    {
        $this->outputFormat = strtolower(trim($outputFormat));
    }

    public function needsWatermarkProcessing(): bool
    {
        return $this->watermarkConfig !== null || $this->implicitWatermark !== null;
    }
}
