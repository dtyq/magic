<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ImageGenerate;

use App\Domain\ImageGenerate\Contract\ImageEnhancementProcessorInterface;
use App\Domain\ImageGenerate\ValueObject\ImplicitWatermark;

/**
 * 空实现的图片增强处理器
 * 在没有商业代码时提供默认实现.
 */
class NullImageEnhancementProcessor implements ImageEnhancementProcessorInterface
{
    public function enhanceImageData(string $imageData, ImplicitWatermark $watermark): string
    {
        // 开源版本不进行任何增强处理，直接返回原始数据
        return $imageData;
    }

    public function enhanceImageUrl(string $imageUrl, ImplicitWatermark $watermark): string
    {
        // 开源版本不进行任何增强处理，直接返回原始URL
        return $imageUrl;
    }

    public function extractEnhancementFromImageData(string $imageData): ?array
    {
        // 开源版本无法提取增强信息
        return null;
    }
}
