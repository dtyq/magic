<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageRemoveBackground\DTO;

class ImageRemoveBackgroundDriverResponse
{
    public function __construct(
        private string $resultFilePath,
        private string $mimeType,
    ) {
    }

    public function getResultFilePath(): string
    {
        return $this->resultFilePath;
    }

    public function getMimeType(): string
    {
        return $this->mimeType;
    }
}
