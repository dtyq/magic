<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

class FilePreSignedUrl
{
    private string $name;

    private string $url;

    private array $headers;

    private int $expires;

    private string $path;

    public function __construct(string $name, string $url, array $headers, int $expires, string $path)
    {
        $this->name = $name;
        $this->url = $url;
        $this->headers = $headers;
        $this->expires = $expires;
        $this->path = $path;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function getHeaders(): array
    {
        return $this->headers;
    }

    public function getExpires(): int
    {
        return $this->expires;
    }

    public function getPath(): string
    {
        return $this->path;
    }
}
