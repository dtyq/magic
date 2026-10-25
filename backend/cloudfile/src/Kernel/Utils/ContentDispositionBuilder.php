<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils;

/**
 * 构建兼容不同浏览器的文件下载响应头.
 */
final class ContentDispositionBuilder
{
    /**
     * 构建兼容浏览器的 Content-Disposition 响应头.
     *
     * @param string $filename 响应文件名
     * @param bool $download 是否以附件形式下载
     */
    public static function build(string $filename, bool $download = true): string
    {
        $safeFilename = self::sanitizeFilename($filename);
        $fallbackFilename = self::buildFallbackFilename($safeFilename);
        $disposition = $download ? 'attachment' : 'inline';

        return $disposition
            . '; filename="' . addcslashes($fallbackFilename, '\"') . '"'
            . "; filename*=UTF-8''" . rawurlencode($safeFilename);
    }

    /**
     * 清理文件名中的控制字符，避免污染响应头.
     *
     * @param string $filename 原始文件名
     */
    private static function sanitizeFilename(string $filename): string
    {
        return (string) preg_replace('/[\x00-\x1F\x7F]/u', '', $filename);
    }

    /**
     * 为不适合直接放入 filename 的文件名生成 ASCII 回退名.
     *
     * @param string $filename 已清理的文件名
     */
    private static function buildFallbackFilename(string $filename): string
    {
        if (preg_match('/^[\x20-\x7E]+$/', $filename) === 1) {
            return $filename;
        }

        $extension = pathinfo($filename, PATHINFO_EXTENSION);
        if (! is_string($extension) || preg_match('/^[A-Za-z0-9]{1,16}$/', $extension) !== 1) {
            return 'download';
        }

        return 'download.' . $extension;
    }
}
