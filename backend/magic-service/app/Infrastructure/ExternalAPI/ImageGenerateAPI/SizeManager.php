<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI;

use InvalidArgumentException;

/**
 * Size 管理器：处理所有 size 相关的转换和计算逻辑.
 */
class SizeManager
{
    /**
     * 根据配置获取尺寸详细配置 (包含 width, height, ratio, scale).
     * @param string $size 尺寸字符串
     * @param string $modelVersion 模型版本
     * @param null|string $modelId 模型ID
     * @return array ['width' => val, 'height' => val, 'ratio' => val, 'scale' => val]
     */
    public static function getSizeConfig(string $size, string $modelVersion, ?string $modelId = null): array
    {
        $config = self::matchConfig($modelVersion, $modelId);
        $size = trim($size);

        // 如果没有找到配置，使用默认解析逻辑
        if (empty($config)) {
            [$w, $h] = self::parseToWidthHeight($size);
            return [
                'width' => $w,
                'height' => $h,
                'ratio' => self::calculateRatio((int) $w, (int) $h),
                'scale' => null,
            ];
        }

        $sizes = $config['sizes'] ?? [];

        // 如果配置中有 total_pixels_range，走同比例像素换算逻辑，完全绕过 sizes 列表匹配
        $pixelRange = $config['total_pixels_range'] ?? null;
        if ($pixelRange !== null) {
            [$w, $h] = self::parseToWidthHeight($size);
            [$w, $h] = self::scaleToPixelRange((int) $w, (int) $h, $pixelRange);
            return [
                'width' => $w,
                'height' => $h,
                'ratio' => self::calculateRatio((int) $w, (int) $h),
                'scale' => null,
            ];
        }

        // 1. 尝试匹配 label (如 "1:1", "16:9") 或 value (如 "1024x1024")
        $matchedSize = self::matchSizeOption($size, $sizes);
        if ($matchedSize !== null) {
            return $matchedSize;
        }

        // 2. 如果是标准格式 1024x1024，但不在配置中，需要降级到配置中最接近的比例对应的尺寸
        if (preg_match('/^(\d+)[x×](\d+)$/iu', $size, $matches)) {
            $width = (int) $matches[1];
            $height = (int) $matches[2];
            return self::fallbackStandardFormatConfig($width, $height, $sizes);
        }

        // 3. 处理比例格式但未在 sizes 中明确列出的情况 (尝试计算最接近的)
        if (preg_match('/^(\d+):(\d+)$/', $size, $matches)) {
            $width = (int) $matches[1];
            $height = (int) $matches[2];
            return self::fallbackRatioFormatConfig($width, $height, $sizes);
        }

        // 默认返回配置中的第一个尺寸
        return self::getDefaultSizeConfig($sizes);
    }

    /**
     * 根据配置获取尺寸 (兼容旧方法).
     * @param string $size 尺寸字符串
     * @param string $modelVersion 模型版本
     * @param null|string $modelId 模型ID
     * @return array [width, height] 数组
     */
    public static function getSizeFromConfig(string $size, string $modelVersion, ?string $modelId = null): array
    {
        $config = self::getSizeConfig($size, $modelVersion, $modelId);
        return [$config['width'], $config['height']];
    }

    /**
     * 解析各种 size 格式为 [width, height] 数组.
     * 支持格式：1024x1024, 1024*1024, 2k, 3k, 16:9, 1:1 等.
     * @param string $size 尺寸字符串
     * @return array [width, height] 数组
     */
    public static function parseToWidthHeight(string $size): array
    {
        $size = trim($size);

        // 处理标准格式：1024x1024
        if (preg_match('/^(\d+)[x×](\d+)$/iu', $size, $matches)) {
            return [(string) $matches[1], (string) $matches[2]];
        }

        // 处理乘号格式：1024*1024
        if (preg_match('/^(\d+)\*(\d+)$/', $size, $matches)) {
            return [(string) $matches[1], (string) $matches[2]];
        }

        // 处理 k 格式：2k, 3k 等
        if (preg_match('/^(\d+)k$/i', $size, $matches)) {
            $resolution = (int) $matches[1] * 1024;
            return [(string) $resolution, (string) $resolution];
        }

        // 处理比例格式：16:9, 1:1, 3:4 等
        if (preg_match('/^(\d+):(\d+)$/', $size, $matches)) {
            $width = (int) $matches[1];
            $height = (int) $matches[2];

            // 按照正常换算（基于1024为基准）
            if ($width >= $height) {
                $actualWidth = 1024;
                $actualHeight = (int) (1024 * $height / $width);
            } else {
                $actualHeight = 1024;
                $actualWidth = (int) (1024 * $width / $height);
            }

            return [(string) $actualWidth, (string) $actualHeight];
        }

        return ['1024', '1024'];
    }

    /**
     * 将分辨率转换成宽高比.
     * @param int $width 宽度
     * @param int $height 高度
     * @param string $modelVersion 模型版本
     * @param null|string $modelId 模型ID
     * @return string 宽高比，如果无法精确匹配则返回最接近的
     */
    public static function convertToAspectRatio(int $width, int $height, string $modelVersion, ?string $modelId = null): string
    {
        $config = self::matchConfig($modelVersion, $modelId);
        if (empty($config)) {
            return self::calculateRatio($width, $height);
        }

        $sizes = $config['sizes'] ?? [];
        $supportedAspectRatios = array_column($sizes, 'label');
        // 过滤出有效的比例字符串
        $supportedAspectRatios = array_filter($supportedAspectRatios, function ($r) {
            return preg_match('/^\d+:\d+$/', $r);
        });

        $calculatedRatio = self::calculateRatio($width, $height);

        if (in_array($calculatedRatio, $supportedAspectRatios, true)) {
            return $calculatedRatio;
        }

        return self::findClosestAspectRatio($width, $height, $supportedAspectRatios);
    }

    /**
     * 计算宽高比例.
     * @param int $width 宽度
     * @param int $height 高度
     * @return string 宽高比，如 "16:9"
     */
    public static function calculateRatio(int $width, int $height): string
    {
        $gcd = self::gcd($width, $height);
        return ($width / $gcd) . ':' . ($height / $gcd);
    }

    /**
     * 根据模型版本、名称和 model_id 匹配配置.
     * @param string $modelVersion 模型版本
     * @param null|string $modelId 模型ID
     * @return null|array 返回配置数组，包含 sizes 和 max_reference_images，如果未匹配到则返回 null
     */
    public static function matchConfig(string $modelVersion, ?string $modelId = null): ?array
    {
        $configs = config('image_models.models', []);
        if (empty($configs)) {
            return null;
        }

        $modelVersion = strtolower($modelVersion);
        $modelId = $modelId !== null ? strtolower($modelId) : null;

        foreach ($configs as $config) {
            foreach ($config['match'] ?? [] as $rule) {
                $field = $rule['field'] ?? '';
                $value = strtolower($rule['value'] ?? '');
                $matchType = strtolower($rule['match_type'] ?? 'exact');

                if ($field === 'model_version' && self::matchesRule($modelVersion, $value, $matchType)) {
                    return $config['config'] ?? null;
                }
                if ($field === 'model_id' && $modelId !== null && self::matchesRule($modelId, $value, $matchType)) {
                    return $config['config'] ?? null;
                }
            }
        }

        return null;
    }

    /**
     * 获取转高清的最大 scale 尺寸列表.
     * @param string $modelVersion 模型版本
     * @param null|string $modelId 模型ID
     * @return array 最大 scale 的尺寸列表
     */
    public static function getMaxScaleSizes(string $modelVersion, ?string $modelId = null): array
    {
        $config = self::matchConfig($modelVersion, $modelId);
        if (empty($config) || empty($config['sizes'])) {
            return [];
        }

        $sizes = $config['sizes'];
        $scales = array_unique(array_column($sizes, 'scale'));

        usort($scales, function ($a, $b) {
            if ($a === null) {
                return 1;
            }
            if ($b === null) {
                return -1;
            }
            preg_match('/^(\d+)/', $a, $matchA);
            preg_match('/^(\d+)/', $b, $matchB);
            return ($matchB[1] ?? 0) <=> ($matchA[1] ?? 0);
        });

        $maxScale = $scales[0] ?? null;
        $sizes = array_values(array_filter($sizes, fn ($size) => ($size['scale'] ?? null) === $maxScale));

        foreach ($sizes as &$size) {
            $size['scale'] = null;
        }
        return $sizes;
    }

    /**
     * 匹配 label 或 value，返回完整配置项.
     * @param string $size 尺寸字符串
     * @param array $sizes 配置中的 sizes 数组
     * @return null|array 如果匹配成功返回 enriched config array，否则返回 null
     */
    private static function matchSizeOption(string $size, array $sizes): ?array
    {
        foreach ($sizes as $option) {
            if (strcasecmp($option['label'], $size) === 0 || $option['value'] === $size) {
                return self::enrichOption($option);
            }
        }

        return null;
    }

    /**
     * 处理标准格式的降级（如 4096x2731 不在配置中，降级到最接近的比例对应的尺寸）.
     * @param int $width 宽度
     * @param int $height 高度
     * @param array $sizes 配置中的 sizes 数组
     * @return array Enriched config array
     */
    private static function fallbackStandardFormatConfig(int $width, int $height, array $sizes): array
    {
        $supportedRatios = self::getSupportedRatios($sizes);

        if (! empty($supportedRatios)) {
            // 计算最接近的比例
            $closestRatio = self::findClosestAspectRatio($width, $height, $supportedRatios);

            // 根据找到的最接近比例，查找对应的尺寸
            $matchedSize = self::getSizeOptionByRatio($closestRatio, $sizes);
            if ($matchedSize !== null) {
                return $matchedSize;
            }
        }

        // 如果没有找到匹配的比例，返回配置的第一个尺寸
        return self::getDefaultSizeConfig($sizes);
    }

    /**
     * 处理比例格式的降级（如 16:10 不在配置中，匹配最接近的比例）.
     * @param int $width 宽度
     * @param int $height 高度
     * @param array $sizes 配置中的 sizes 数组
     * @return array Enriched config array
     */
    private static function fallbackRatioFormatConfig(int $width, int $height, array $sizes): array
    {
        $supportedRatios = self::getSupportedRatios($sizes);

        if (! empty($supportedRatios)) {
            $closestRatio = self::findClosestAspectRatio($width, $height, $supportedRatios);

            // 根据找到的最接近比例，查找对应的尺寸
            $matchedSize = self::getSizeOptionByRatio($closestRatio, $sizes);
            if ($matchedSize !== null) {
                return $matchedSize;
            }
        }

        return self::getDefaultSizeConfig($sizes);
    }

    /**
     * 获取配置中支持的比例列表.
     * @param array $sizes 配置中的 sizes 数组
     * @return array 比例列表，如 ['1:1', '16:9', '3:2']
     */
    private static function getSupportedRatios(array $sizes): array
    {
        $supportedRatios = array_column($sizes, 'label');
        return array_filter($supportedRatios, function ($r) {
            return preg_match('/^\d+:\d+$/', $r);
        });
    }

    /**
     * 根据比例获取对应的尺寸配置项.
     * @param string $ratio 比例，如 "16:9"
     * @param array $sizes 配置中的 sizes 数组
     * @return null|array 如果找到返回 enriched config array，否则返回 null
     */
    private static function getSizeOptionByRatio(string $ratio, array $sizes): ?array
    {
        foreach ($sizes as $option) {
            if ($option['label'] === $ratio) {
                return self::enrichOption($option);
            }
        }

        return null;
    }

    /**
     * 获取默认尺寸配置项.
     * @param array $sizes 配置中的 sizes 数组
     * @return array Enriched config array
     */
    private static function getDefaultSizeConfig(array $sizes): array
    {
        if (! empty($sizes)) {
            return self::enrichOption($sizes[0]);
        }

        return [
            'width' => '1024',
            'height' => '1024',
            'ratio' => '1:1',
            'scale' => null,
        ];
    }

    /**
     * 丰富配置选项，解析宽高.
     */
    private static function enrichOption(array $option): array
    {
        $parts = explode('x', $option['value']);
        return [
            'width' => $parts[0] ?? '1024',
            'height' => $parts[1] ?? '1024',
            'ratio' => $option['label'] ?? '1:1',
            'scale' => $option['scale'] ?? null,
        ];
    }

    /**
     * 查找最接近的宽高比.
     * @param int $width 宽度
     * @param int $height 高度
     * @param array $supportedAspectRatios 支持的宽高比列表
     * @return string 最接近的宽高比
     */
    private static function findClosestAspectRatio(int $width, int $height, array $supportedAspectRatios): string
    {
        if (empty($supportedAspectRatios)) {
            return '1:1';
        }

        $targetRatio = $width / $height;
        $closestRatio = '1:1';
        $minDifference = PHP_FLOAT_MAX;

        foreach ($supportedAspectRatios as $ratio) {
            if (preg_match('/^(\d+):(\d+)$/', $ratio, $matches)) {
                $ratioValue = (int) $matches[1] / (int) $matches[2];
                $difference = abs($targetRatio - $ratioValue);

                if ($difference < $minDifference) {
                    $minDifference = $difference;
                    $closestRatio = $ratio;
                }
            }
        }

        return $closestRatio;
    }

    /**
     * 将宽高同比例缩放，使总像素落入 [min, max] 区间.
     *
     * 总像素 P = width * height：
     *   P < min  ->  scale = sqrt(min / P)，放大
     *   P > max  ->  scale = sqrt(max / P)，缩小
     *   min <= P <= max  ->  原样返回
     *
     * @param int $width 原始宽度
     * @param int $height 原始高度
     * @param array $pixelRange ['min' => int, 'max' => int]
     * @return array [width_str, height_str]
     */
    private static function scaleToPixelRange(int $width, int $height, array $pixelRange): array
    {
        $min = (int) ($pixelRange['min'] ?? 0);
        $max = (int) ($pixelRange['max'] ?? PHP_INT_MAX);
        $pixels = $width * $height;

        if ($pixels <= 0) {
            return [(string) $width, (string) $height];
        }

        if ($pixels < $min) {
            $scale = sqrt($min / $pixels);
            // ceil 保证放大后总像素不低于 min
            $width = (int) ceil($width * $scale);
            $height = (int) ceil($height * $scale);
        } elseif ($pixels > $max) {
            $scale = sqrt($max / $pixels);
            // floor 保证缩小后总像素不高于 max
            $width = (int) floor($width * $scale);
            $height = (int) floor($height * $scale);
        }

        return [(string) $width, (string) $height];
    }

    /**
     * 计算最大公约数.
     * @param int $a 第一个数
     * @param int $b 第二个数
     * @return int 最大公约数
     */
    private static function gcd(int $a, int $b): int
    {
        if ($a === 0 && $b === 0) {
            throw new InvalidArgumentException('Both numbers cannot be zero');
        }

        $a = abs($a);
        $b = abs($b);

        while ($b !== 0) {
            [$a, $b] = [$b, $a % $b];
        }

        return $a;
    }

    private static function matchesRule(string $actualValue, string $expectedValue, string $matchType): bool
    {
        return match ($matchType) {
            'fuzzy' => str_contains($actualValue, $expectedValue),
            default => $actualValue === $expectedValue,
        };
    }
}
