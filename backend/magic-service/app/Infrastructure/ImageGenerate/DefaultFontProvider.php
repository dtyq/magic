<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ImageGenerate;

use App\Domain\ImageGenerate\Contract\FontProviderInterface;

/**
 * 默认字体提供者实现
 * 开源项目中的默认实现，提供基础字体功能
 * 企业项目可以通过依赖注入覆盖此实现来提供高级字体功能.
 */
class DefaultFontProvider implements FontProviderInterface
{
    /**
     * 获取TTF字体文件路径.
     * 开源版本不提供TTF字体文件.
     */
    public function getFontPath(): ?string
    {
        return null;
    }

    /**
     * 检测是否支持TTF字体渲染.
     * 开源版本仅支持内置字体.
     */
    public function supportsTTF(): bool
    {
        return false;
    }

    /**
     * 检测文本是否包含中文字符.
     * 开源版本视所有文本为非中文，使用内置字体渲染.
     */
    public function containsChinese(string $text): bool
    {
        return false;
    }

    /**
     * 检测图像是否包含透明通道.
     * 提供基础的透明度检测功能.
     * @param mixed $image
     */
    public function hasTransparency($image): bool
    {
        if (! imageistruecolor($image)) {
            // 调色板图像检查透明色索引
            return imagecolortransparent($image) !== -1;
        }

        // 真彩色图像检查alpha通道
        $width = imagesx($image);
        $height = imagesy($image);

        // 采样检查，避免检查每个像素提高性能
        $sampleSize = min(50, $width, $height);
        $stepX = max(1, (int) ($width / $sampleSize));
        $stepY = max(1, (int) ($height / $sampleSize));

        for ($x = 0; $x < $width; $x += $stepX) {
            for ($y = 0; $y < $height; $y += $stepY) {
                $rgba = imagecolorat($image, $x, $y);
                $alpha = ($rgba & 0x7F000000) >> 24;
                if ($alpha > 0) {
                    return true; // 发现透明像素
                }
            }
        }

        return false;
    }
}
