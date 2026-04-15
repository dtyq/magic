<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\File;

use InvalidArgumentException;

/**
 * 基于真实文件内容探测 MIME，并限制只允许图片文件进入后续处理链路。
 */
class ImageFileInspector
{
    public function detectMimeType(string $filePath): string
    {
        if (! is_file($filePath)) {
            throw new InvalidArgumentException('image_generate.file_not_found');
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = $finfo ? finfo_file($finfo, $filePath) : false;
        if ($finfo) {
            finfo_close($finfo);
        }

        if (! is_string($mimeType) || $mimeType === '') {
            throw new InvalidArgumentException('image_generate.response_format_error');
        }

        return $mimeType;
    }

    /**
     * 校验文件是否为允许的图片 MIME。
     */
    public function assertImageFile(string $filePath): string
    {
        $mimeType = $this->detectMimeType($filePath);
        if (! str_starts_with($mimeType, 'image/')) {
            throw new InvalidArgumentException('image_generate.remove_background_only_image_allowed');
        }

        return $mimeType;
    }
}
