<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\DTO;

/**
 * Image convert high definition config DTO.
 */
class ImageConvertHighConfigDTO
{
    /**
     * Whether convert high is supported.
     */
    protected bool $supported = false;

    /**
     * Image size config.
     *
     * @var array<string, mixed>
     */
    protected array $imageSizeConfig = [];

    public function isSupported(): bool
    {
        return $this->supported;
    }

    public function setSupported(bool $supported): self
    {
        $this->supported = $supported;
        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function getImageSizeConfig(): array
    {
        return $this->imageSizeConfig;
    }

    /**
     * @param array<string, mixed> $imageSizeConfig
     */
    public function setImageSizeConfig(array $imageSizeConfig): self
    {
        $this->imageSizeConfig = $imageSizeConfig;
        return $this;
    }

    /**
     * Convert to array format.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'supported' => $this->supported,
            'image_size_config' => $this->imageSizeConfig,
        ];
    }
}
