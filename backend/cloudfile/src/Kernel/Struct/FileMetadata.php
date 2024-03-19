<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

use League\Flysystem\FileAttributes;

class FileMetadata
{
    private string $name;

    private string $path;

    private FileAttributes $fileAttributes;

    public function __construct(string $name, string $path, FileAttributes $fileAttributes)
    {
        $this->name = $name;
        $this->path = $path;
        $this->fileAttributes = $fileAttributes;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    public function getFileAttributes(): FileAttributes
    {
        return $this->fileAttributes;
    }

    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'path' => $this->path,
            'metadata' => $this->fileAttributes->jsonSerialize(),
        ];
    }
}
