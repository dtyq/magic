<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\File\DTO;

class SecureDownloadedImageDTO
{
    public function __construct(
        private string $tempFilePath,
        private string $mimeType,
        private int $size,
    ) {
    }

    public function getTempFilePath(): string
    {
        return $this->tempFilePath;
    }

    public function getMimeType(): string
    {
        return $this->mimeType;
    }

    public function getSize(): int
    {
        return $this->size;
    }
}
