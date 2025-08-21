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
 * 开源项目中的默认实现，不启用水印
 * 企业项目可以通过继承或重新实现来提供具体的水印逻辑.
 */
class DefaultWatermarkConfig implements WatermarkConfigInterface
{
    public function getWatermarkConfig(?string $orgCode = null): ?WatermarkConfig
    {
        // 开源版本默认不启用水印
        return new WatermarkConfig(
            logoTextContent: 'Magic AI Generated', // 默认水印文字
            position: 3, // 右下角
            opacity: 0.3, // 30% 透明度,
        );
    }
}
