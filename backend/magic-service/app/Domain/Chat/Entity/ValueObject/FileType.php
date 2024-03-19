<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

enum FileType: int
{
    // 文件
    case File = 0;

    // 链接
    case Link = 1;

    // Word
    case Word = 2;

    // PPT
    case PPT = 3;

    // Excel
    case Excel = 4;

    // 图片
    case Image = 5;

    // 视频
    case Video = 6;

    // 音频
    case Audio = 7;

    // 压缩包
    case Compress = 8;

    public static function getTypeFromFileExtension(string $fileExtension): self
    {
        // 从文件的扩展名，推理出文件类型
        return match (strtolower($fileExtension)) {
            // 网址
            'http', 'https' => self::Link,
            // doc
            'doc', 'docx', 'dot' => self::Word,
            // ppt
            'ppt', 'pptx', 'pot', 'pps', => self::PPT,
            // excel
            'xls', 'xlsx', 'xlsm', 'xlsb' => self::Excel,
            // 图片
            'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp' => self::Image,
            // 视频
            'mp4', 'avi', 'rmvb', 'rm', 'mpg', 'mpeg', 'mpe', 'wmv', 'mkv', 'vob', 'mov', 'qt', 'flv', 'f4v', 'swf' => self::Video,
            // 音频
            'mp3', 'wma', 'wav', 'mod', 'ra', 'cd', 'md', 'asf', 'aac', 'ape', 'mid', 'ogg', 'm4a', 'vqf' => self::Audio,
            // 压缩包
            'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'cab', 'iso', 'lzh', 'ace', 'arj', 'uue', 'jar' => self::Compress,
            default => self::File,
        };
    }
}
