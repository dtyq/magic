<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ImageGenerate\Contract;

use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;

/**
 * 水印配置接口
 * 用于在开源项目中定义水印配置规范，由企业项目实现具体逻辑.
 */
interface WatermarkConfigInterface
{
    /**
     * 获取水印配置.
     *
     * @param null|string $orgCode 组织代码，用于判断是否启用水印
     * @return null|WatermarkConfig 返回水印配置，如果为null则不添加水印
     */
    public function getWatermarkConfig(?string $orgCode = null): ?WatermarkConfig;
}
