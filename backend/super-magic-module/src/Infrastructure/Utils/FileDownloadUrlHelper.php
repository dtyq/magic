<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use function Hyperf\Translation\trans;

/**
 * Helper class for preparing file download URL options.
 * Handles Content-Type, Content-Disposition, and watermark parameters without entity dependencies.
 */
class FileDownloadUrlHelper
{
    /**
     * Prepare file URL options with proper headers and watermark parameters.
     *
     * @param string $filename File name
     * @param string $downloadMode Download mode: 'preview', 'inline', 'high_quality', 'download'
     * @param bool $addWatermark Whether to add watermark for images
     * @param null|int $fileSourceValue File source value (for watermark logic)
     * @return array URL options array with content_type, custom_query, and filename
     */
    public static function prepareFileUrlOptions(
        string $filename,
        string $downloadMode = 'download',
        bool $addWatermark = false,
        ?int $fileSourceValue = null
    ): array {
        $urlOptions = [];

        // Set Content-Type based on file extension
        $urlOptions['content_type'] = ContentTypeUtil::getContentType($filename);

        // Set Content-Disposition based on download mode and HTTP standards
        switch (strtolower($downloadMode)) {
            case 'preview':
            case 'inline':
                // Preview mode: inline if previewable, otherwise force download
                if (ContentTypeUtil::isPreviewable($filename)) {
                    $urlOptions['custom_query']['response-content-disposition']
                        = ContentTypeUtil::buildContentDispositionHeader($filename, 'inline');
                } else {
                    $urlOptions['custom_query']['response-content-disposition']
                        = ContentTypeUtil::buildContentDispositionHeader($filename, 'attachment');
                }

                // Add watermark parameters if enabled and file is an image
                if ($addWatermark && self::isImageFile($filename)) {
                    $watermarkParams = self::getWatermarkParameters($fileSourceValue);
                    if (! empty($watermarkParams)) {
                        $urlOptions['custom_query'] = array_merge($urlOptions['custom_query'] ?? [], $watermarkParams);
                    }
                }

                break;
            case 'high_quality':
            case 'download':
            default:
                // Download mode: force download with standard attachment format
                $urlOptions['custom_query']['response-content-disposition']
                    = ContentTypeUtil::buildContentDispositionHeader($filename, 'attachment');
                break;
        }

        // Set Content-Type response header
        $urlOptions['custom_query']['response-content-type'] = $urlOptions['content_type'];

        // Set filename for presigned URL generation
        $urlOptions['filename'] = $filename;

        return $urlOptions;
    }

    /**
     * Check if file is an image based on file extension.
     *
     * @param string $filename File name
     * @return bool True if file is an image, false otherwise
     */
    private static function isImageFile(string $filename): bool
    {
        $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        return in_array($extension, $imageExtensions);
    }

    /**
     * Get watermark parameters for cloud storage.
     *
     * @param null|int $fileSourceValue File source value
     * @return array Watermark parameters for the cloud storage driver
     */
    private static function getWatermarkParameters(?int $fileSourceValue): array
    {
        $driver = env('FILE_SERVICE_PUBLIC_PLATFORM') ?? env('FILE_SERVICE_PRIVATE_PLATFORM');

        if (empty($driver)) {
            $driver = env('FILE_DRIVER');
        }

        if (empty($driver)) {
            return [];
        }

        $watermarkText = self::getWatermarkText();
        switch ($driver) {
            case 'aliyun':
            case 'oss':
                $watermarkText = $watermarkText . '?x-oss-process=image/resize,p_30';
                break;
            case 'tos':
                $watermarkText = $watermarkText . '?x-tos-process=image/resize,p_30';
                break;
            default:
                break;
        }

        // Use base64url encoding for cloud storage compatibility
        $base64WatermarkKey = self::base64UrlEncode($watermarkText);

        // AI_IMAGE_GENERATION = 5
        if ($fileSourceValue === 5) {
            $watermark = 'image/watermark,image_' . $base64WatermarkKey . ',t_100,g_se,x_10,y_10';
        } else {
            $watermark = '';
        }

        switch ($driver) {
            case 'aliyun':
            case 'oss':
                return [
                    'x-oss-process' => $watermark,
                ];
            case 'tos':
                return [
                    'x-tos-process' => $watermark,
                ];
            default:
                return [];
        }
    }

    /**
     * Get watermark text from translation.
     *
     * @return string Watermark text
     */
    private static function getWatermarkText(): string
    {
        return trans('image_generate.image_watermark');
    }

    /**
     * Base64 URL-safe encoding.
     *
     * @param string $data Data to encode
     * @return string Base64 URL-safe encoded string
     */
    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
