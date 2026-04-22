<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ImageGenerate;

use App\Domain\ImageGenerate\Contract\WatermarkConfigInterface;
use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;

/**
 * 默认水印配置实现
 * 默认返回一份可用的明水印配置
 * 企业项目可以通过继承或重新实现来提供具体的水印逻辑.
 */
class DefaultWatermarkConfig implements WatermarkConfigInterface
{
    public function getWatermarkConfig(?string $orgCode = null): ?WatermarkConfig
    {
        // 默认返回一份基础的明水印配置。
        return new WatermarkConfig(
            logoTextContent: 'Magic AI Generated', // 默认水印文字
            position: 3, // 右下角
            opacity: 0.3, // 30% 透明度,
        );
    }
}
