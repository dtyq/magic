<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

/**
 * 图片输出格式转换工具.
 *
 * 内部以 MIME type 作为唯一标准格式（如 "image/png"），接受多种输入形式并统一标准化。
 * 通过 image_models 配置中的 supported_output_formats 映射，将 MIME type 转换为各厂商
 * API 实际接受的参数值。
 *
 * 输入支持：
 * - 简短格式：png、PNG、jpeg、jpg、WEBP
 * - MIME type 格式：image/png、IMAGE/PNG、image/jpeg
 *
 * 厂商参数差异（通过配置 supported_output_formats 映射控制）：
 * - Doubao Seedream 4.0/4.5（火山方舟）：大写格式，如 "PNG"、"JPG"、"WEBP"
 * - Google Gemini 3 系列：MIME type 格式，如 "image/png"（映射值与 key 相同）
 */
class ImageOutputFormatConverter
{
    /**
     * jpg 别名映射（统一转为 jpeg 再构建 MIME type）.
     */
    private const FORMAT_ALIAS_MAP = [
        'jpg' => 'jpeg',
    ];

    /**
     * 将用户输入的格式字符串标准化为 MIME type 格式.
     *
     * 支持输入：
     * - 简短格式："png"、"PNG"、"jpeg"、"jpg"（jpg 自动映射为 jpeg）
     * - MIME type 格式："image/png"、"IMAGE/PNG"、"image/jpeg"
     *
     * 返回标准小写 MIME type，如 "image/png"；空字符串表示输入为空。
     * 注意：此方法不校验格式是否被模型支持，仅做格式标准化。
     */
    public static function normalize(string $outputFormat): string
    {
        $outputFormat = strtolower(trim($outputFormat));

        if ($outputFormat === '') {
            return '';
        }

        // 已是 MIME type 格式（含"/"），取最后一段作为简短格式再重新构建
        if (str_contains($outputFormat, '/')) {
            $parts = explode('/', $outputFormat);
            $outputFormat = end($parts);
        }

        // 处理别名，如 "jpg" → "jpeg"
        if (isset(self::FORMAT_ALIAS_MAP[$outputFormat])) {
            $outputFormat = self::FORMAT_ALIAS_MAP[$outputFormat];
        }

        return 'image/' . $outputFormat;
    }

    /**
     * 根据模型配置解析输出格式，返回厂商 API 实际参数值.
     *
     * 流程：
     * 1. 将用户输入标准化为 MIME type（如 "image/png"）
     * 2. 在 image_models 配置的 supported_output_formats 映射中查找
     * 3. 找到则返回厂商参数值（如 Doubao 返回 "PNG"，Google 返回 "image/png"）
     * 4. 找不到则抛出 UNSUPPORTED_OUTPUT_FORMAT 异常
     *
     * @param string $outputFormat 用户传入的格式字符串
     * @param array $modelConfig SizeManager::matchConfig() 返回的模型配置
     * @return string 厂商 API 实际参数值
     */
    public static function resolveForModel(string $outputFormat, array $modelConfig): string
    {
        $mimeType = self::normalize($outputFormat);

        $supportedFormats = $modelConfig['supported_output_formats'] ?? [];

        if (! isset($supportedFormats[$mimeType])) {
            $supportedKeys = implode(', ', array_keys($supportedFormats));
            ExceptionBuilder::throw(
                ImageGenerateErrorCode::UNSUPPORTED_OUTPUT_FORMAT,
                'image_generate.unsupported_output_format',
                ['format' => $outputFormat, 'supported' => $supportedKeys]
            );
        }

        return $supportedFormats[$mimeType];
    }
}
