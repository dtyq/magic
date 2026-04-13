<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Image;

final class ImageAsset
{
    public const TYPE_LOCAL_FILE = 'local_file';

    public const TYPE_REMOTE_URL = 'remote_url';

    public function __construct(
        private readonly string $type,
        private readonly string $value,
        private readonly string $mimeType = '',
        private readonly ?string $provider = null,
        private readonly ?int $size = null,
    ) {
    }

    public static function fromLocalFile(
        string $localFilePath,
        string $mimeType,
        ?string $provider = null,
        ?int $size = null,
    ): self {
        return new self(self::TYPE_LOCAL_FILE, $localFilePath, $mimeType, $provider, $size);
    }

    public static function fromRemoteUrl(
        string $remoteUrl,
        string $mimeType = '',
        ?string $provider = null,
    ): self {
        return new self(self::TYPE_REMOTE_URL, $remoteUrl, $mimeType, $provider);
    }

    public function isLocalFile(): bool
    {
        return $this->type === self::TYPE_LOCAL_FILE;
    }

    public function isRemoteUrl(): bool
    {
        return $this->type === self::TYPE_REMOTE_URL;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getValue(): string
    {
        return $this->value;
    }

    public function getMimeType(): string
    {
        return $this->mimeType;
    }

    public function getProvider(): ?string
    {
        return $this->provider;
    }

    public function getSize(): ?int
    {
        return $this->size;
    }
}
