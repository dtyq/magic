<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\File;

use InvalidArgumentException;

class EasyFileTools
{
    public static function formatPath(?string $path): string
    {
        if (empty($path)) {
            return '';
        }
        if (is_url($path)) {
            $parsedUrl = parse_url($path);
            $path = $parsedUrl['path'] ?? '';
            $path = trim($path, '/');
        }

        // 剔除路径中的 bucket 前缀，找到第一个符合组织编码规则的片段
        $buckets = self::getAllBuckets();
        $segments = explode('/', $path);
        $foundIndex = -1;

        foreach ($segments as $index => $segment) {
            // 检查片段是否只包含英文字母和数字，且不是已存在的存储桶列表中
            if (! empty($segment) && preg_match('/^[a-zA-Z0-9]+$/', $segment) && ! in_array($segment, $buckets, true)) {
                $foundIndex = $index;
                break;
            }
        }

        // 如果找到了组织编码，且不是第一个片段，则需要去掉前面的片段
        if ($foundIndex > 0) {
            $path = implode('/', array_slice($segments, $foundIndex));
        }

        return $path;
    }

    public static function saveFile(string $path, string $stream): void
    {
        $file = fopen($path, 'wb');
        // 把stream切割成1000kb的小块，每次写入文件

        fwrite($file, $stream);
        fclose($file);
    }

    public static function mergeWavFiles(string $file1, string $blob): void
    {
        // 如果文件不存在，直接将 blob 写入为新的文件
        if (! file_exists($file1)) {
            self::saveFile($file1, $blob);
            return;
        }

        // 打开 file1 文件以读写模式
        $wav1 = fopen($file1, 'r+b');
        if (! $wav1) {
            throw new InvalidArgumentException('Failed to open the base file.');
        }
        // 去掉blob的头
        $blob = substr($blob, 44);

        // 将新数据追加到文件末尾
        // 获取文件大小
        fseek($wav1, 0, SEEK_END);
        fwrite($wav1, $blob);
        $fileSize = ftell($wav1);

        // 修正 RIFF 块大小（文件总大小 - 8）
        fseek($wav1, 4);
        fwrite($wav1, pack('V', $fileSize - 8));

        // 修正 data 块大小（文件总大小 - 44）
        fseek($wav1, 40);
        fwrite($wav1, pack('V', $fileSize - 44));

        // 关闭文件
        fclose($wav1);
    }

    /**
     * 获取所有配置的存储桶名称.
     */
    private static function getAllBuckets(): array
    {
        $buckets = [];
        $storages = config('cloudfile.storages', []);
        foreach ($storages as $storage) {
            if (! $config = $storage['config'] ?? null) {
                continue;
            }
            $bucket = $config['bucket'] ?? $config['key'] ?? null;
            if (! empty($bucket)) {
                $buckets[] = $bucket;
            }
        }
        return $buckets;
    }

    //    public static function getAudioFormat(string $filePath)
    //    {
    //        $riff = RIFF::fromFilePath($filePath);
    //
    //        foreach ($riff->subChunks as $chunk) {
    //            if ($chunk instanceof FMTChunk) {
    //                return $chunk;
    //            }
    //        }
    //
    //        throw new InvalidArgumentException('Missing FMT chunk in the file');
    //    }
}
