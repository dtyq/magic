<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ImageGenerate\Contract;

use App\Domain\ImageGenerate\ValueObject\ImplicitWatermark;

/**
 * 图片增强处理器接口
 * 用于为图片嵌入增强信息（如隐式水印等）.
 */
interface ImageEnhancementProcessorInterface
{
    /**
     * 为图片数据嵌入增强信息.
     */
    public function enhanceImageData(string $imageData, ImplicitWatermark $watermark): string;

    /**
     * 为图片URL嵌入增强信息.
     */
    public function enhanceImageUrl(string $imageUrl, ImplicitWatermark $watermark): string;

    /**
     * 从图片数据提取增强信息.
     */
    public function extractEnhancementFromImageData(string $imageData): ?array;
}
