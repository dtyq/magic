<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Driver\S3;

use Aws\S3\S3Client;
use League\Flysystem\AwsS3V3\AwsS3V3Adapter;
use League\Flysystem\AwsS3V3\PortableVisibilityConverter;
use League\Flysystem\Config;
use League\Flysystem\FileAttributes;
use League\Flysystem\FilesystemAdapter;
use League\Flysystem\UnableToWriteFile;
use League\Flysystem\Visibility;

class S3Driver implements FilesystemAdapter
{
    protected AwsS3V3Adapter $adapter;

    protected S3Client $client;

    protected array $config;

    protected string $bucket;

    /**
     * @param array $config = [
     *                      'region' => '',
     *                      'endpoint' => '',
     *                      'accessKey' => '',
     *                      'secretKey' => '',
     *                      'bucket' => '',
     *                      'use_path_style_endpoint' => true, // MinIO required
     *                      'version' => 'latest',
     *                      ]
     */
    public function __construct(array $config = [])
    {
        $this->config = $config;
        $this->bucket = $config['bucket'] ?? '';

        $this->client = new S3Client([
            'version' => $config['version'] ?? 'latest',
            'region' => $config['region'] ?? 'us-east-1',
            'endpoint' => $config['endpoint'] ?? null,
            'use_path_style_endpoint' => $config['use_path_style_endpoint'] ?? true,
            'credentials' => [
                'key' => $config['accessKey'] ?? '',
                'secret' => $config['secretKey'] ?? '',
            ],
        ]);

        $visibilityConverter = new PortableVisibilityConverter(
            $config['visibility'] ?? Visibility::PUBLIC
        );

        $this->adapter = new AwsS3V3Adapter(
            $this->client,
            $this->bucket,
            '',
            $visibilityConverter
        );
    }

    public function fileExists(string $path): bool
    {
        return $this->adapter->fileExists($path);
    }

    public function write(string $path, string $contents, Config $config): void
    {
        $this->adapter->write($path, $contents, $config);
    }

    public function writeStream(string $path, $contents, Config $config): void
    {
        if (! is_resource($contents)) {
            throw UnableToWriteFile::atLocation($path, 'The contents is invalid resource.');
        }

        $this->adapter->writeStream($path, $contents, $config);
    }

    public function read(string $path): string
    {
        return $this->adapter->read($path);
    }

    public function readStream(string $path)
    {
        return $this->adapter->readStream($path);
    }

    public function delete(string $path): void
    {
        $this->adapter->delete($path);
    }

    public function deleteDirectory(string $path): void
    {
        $this->adapter->deleteDirectory($path);
    }

    public function createDirectory(string $path, Config $config): void
    {
        $this->adapter->createDirectory($path, $config);
    }

    public function setVisibility(string $path, string $visibility): void
    {
        $this->adapter->setVisibility($path, $visibility);
    }

    public function visibility(string $path): FileAttributes
    {
        return $this->adapter->visibility($path);
    }

    public function mimeType(string $path): FileAttributes
    {
        return $this->adapter->mimeType($path);
    }

    public function lastModified(string $path): FileAttributes
    {
        return $this->adapter->lastModified($path);
    }

    public function fileSize(string $path): FileAttributes
    {
        return $this->adapter->fileSize($path);
    }

    public function listContents(string $path, bool $deep): iterable
    {
        return $this->adapter->listContents($path, $deep);
    }

    public function move(string $source, string $destination, Config $config): void
    {
        $this->adapter->move($source, $destination, $config);
    }

    public function copy(string $source, string $destination, Config $config): void
    {
        $this->adapter->copy($source, $destination, $config);
    }

    public function getClient(): S3Client
    {
        return $this->client;
    }

    public function getBucket(): string
    {
        return $this->bucket;
    }
}
