<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

class FileLink
{
    private string $path;

    private string $url;

    private int $expires;

    private string $downloadName;

    public function __construct(string $path, string $url, int $expires, string $downloadName = '')
    {
        $this->path = $path;
        $this->url = $url;
        $this->expires = $expires;
        $this->downloadName = $downloadName;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function getExpires(): int
    {
        return $this->expires;
    }

    public function getDownloadName(): string
    {
        return $this->downloadName;
    }

    public function toArray(): array
    {
        return [
            'path' => $this->path,
            'url' => $this->url,
            'expires' => $this->expires,
            'download_name' => $this->downloadName,
        ];
    }

    public function setUrl(string $url): void
    {
        $this->url = $url;
    }
}
