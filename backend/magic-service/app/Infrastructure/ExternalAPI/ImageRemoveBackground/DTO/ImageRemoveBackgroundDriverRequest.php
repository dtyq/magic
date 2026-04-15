<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageRemoveBackground\DTO;

class ImageRemoveBackgroundDriverRequest
{
    public const SOURCE_TYPE_URL = 'url';

    public const SOURCE_TYPE_FILE = 'file';

    public function __construct(
        private string $sourceType,
        private string $sourceValue,
        private ?string $sourceMimeType,
        private ?string $outputFormat,
    ) {
    }

    public function getSourceType(): string
    {
        return $this->sourceType;
    }

    public function getSourceValue(): string
    {
        return $this->sourceValue;
    }

    public function getSourceMimeType(): ?string
    {
        return $this->sourceMimeType;
    }

    public function getOutputFormat(): ?string
    {
        return $this->outputFormat;
    }
}
