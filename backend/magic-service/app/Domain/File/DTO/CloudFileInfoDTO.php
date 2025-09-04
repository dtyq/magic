<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\DTO;

/**
 * 云存储文件信息DTO.
 */
readonly class CloudFileInfoDTO
{
    public function __construct(
        private string $key,
        private string $filename,
        private ?int $size = null,
        private ?string $lastModified = null
    ) {
    }

    /**
     * 获取文件key.
     */
    public function getKey(): string
    {
        return $this->key;
    }

    /**
     * 获取文件名.
     */
    public function getFilename(): string
    {
        return $this->filename;
    }

    /**
     * 获取文件大小.
     */
    public function getSize(): ?int
    {
        return $this->size;
    }

    /**
     * 获取最后修改时间.
     */
    public function getLastModified(): ?string
    {
        return $this->lastModified;
    }

    /**
     * 从数组创建DTO.
     */
    public static function fromArray(array $data): self
    {
        return new self(
            key: $data['key'] ?? '',
            filename: $data['filename'] ?? '',
            size: $data['size'] ?? null,
            lastModified: $data['last_modified'] ?? null
        );
    }

    /**
     * 转换为数组（向后兼容）.
     */
    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'filename' => $this->filename,
            'size' => $this->size,
            'last_modified' => $this->lastModified,
        ];
    }
}
