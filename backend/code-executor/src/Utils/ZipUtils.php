<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Utils;

class ZipUtils
{
    public static function zipDirectory(string $sourceDir): string
    {
        $zipFile = $sourceDir . '.zip';
        $zip = new \ZipArchive();
        $zip->open($zipFile, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);

        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($sourceDir),
            \RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $file) {
            if (! $file->isDir()) {
                $relativePath = substr($file->getPathname(), strlen($sourceDir) + 1);
                $zip->addFile($file->getPathname(), $relativePath);
            }
        }

        $zip->close();

        return $zipFile;
    }

    /**
     * 将指定目录打包成zip并返回base64编码
     *
     * @param string $sourceDir 源目录路径
     * @return string zip文件的base64编码
     */
    public static function zipDirectoryToBase64(string $sourceDir): string
    {
        $zipFile = self::zipDirectory($sourceDir);
        $content = base64_encode(file_get_contents($zipFile));
        unlink($zipFile);
        return $content;
    }
}
