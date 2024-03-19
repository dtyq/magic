<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Driver\FileService;

use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use League\Flysystem\Config;
use League\Flysystem\FileAttributes;
use League\Flysystem\FilesystemAdapter;

class FileServiceDriver implements FilesystemAdapter
{
    private FileServiceApi $fileServiceApi;

    public function __construct(FileServiceApi $fileServiceApi)
    {
        $this->fileServiceApi = $fileServiceApi;
    }

    public function getFileServiceApi(): FileServiceApi
    {
        return $this->fileServiceApi;
    }

    public function fileExists(string $path): bool
    {
        throw new CloudFileException('暂不支持');
    }

    public function write(string $path, string $contents, Config $config): void
    {
        throw new CloudFileException('暂不支持');
    }

    public function writeStream(string $path, $contents, Config $config): void
    {
        throw new CloudFileException('暂不支持');
    }

    public function read(string $path): string
    {
        throw new CloudFileException('暂不支持');
    }

    public function delete(string $path): void
    {
        throw new CloudFileException('暂不支持');
    }

    public function fileSize(string $path): FileAttributes
    {
        throw new CloudFileException('暂不支持');
    }

    public function move(string $source, string $destination, Config $config): void
    {
        throw new CloudFileException('暂不支持');
    }

    public function copy(string $source, string $destination, Config $config): void
    {
        throw new CloudFileException('暂不支持');
    }

    public function readStream(string $path)
    {
        throw new CloudFileException('暂不支持');
    }

    public function deleteDirectory(string $path): void
    {
        throw new CloudFileException('暂不支持');
    }

    public function createDirectory(string $path, Config $config): void
    {
        throw new CloudFileException('暂不支持');
    }

    public function setVisibility(string $path, string $visibility): void
    {
        throw new CloudFileException('暂不支持');
    }

    public function visibility(string $path): FileAttributes
    {
        throw new CloudFileException('暂不支持');
    }

    public function mimeType(string $path): FileAttributes
    {
        throw new CloudFileException('暂不支持');
    }

    public function lastModified(string $path): FileAttributes
    {
        throw new CloudFileException('暂不支持');
    }

    public function listContents(string $path, bool $deep): iterable
    {
        throw new CloudFileException('暂不支持');
    }
}
