<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\Assembler;

use Dtyq\CloudFile\Kernel\Struct\FileLink;

class FileAssembler
{
    public static function getUrl(?FileLink $fileLink): string
    {
        return $fileLink?->getUrl() ?? '';
    }

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
        return $path;
    }
}
