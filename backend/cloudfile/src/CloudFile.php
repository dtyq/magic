<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile;

use Dtyq\CloudFile\Kernel\AdapterName;
use Dtyq\CloudFile\Kernel\Driver\FileService\FileServiceApi;
use Dtyq\CloudFile\Kernel\Driver\Local\LocalDriver;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\FilesystemProxy;
use Dtyq\SdkBase\SdkBase;
use League\Flysystem\FilesystemAdapter;
use Xxtime\Flysystem\Aliyun\OssAdapter;

class CloudFile
{
    private array $resolvers = [];

    private array $configs;

    private SdkBase $container;

    public function __construct(SdkBase $container)
    {
        $this->container = $container;
        $this->configs = $container->getConfig()->get('cloudfile', []);
    }

    public function get(string $storage): FilesystemProxy
    {
        if (isset($this->resolvers[$storage])) {
            return $this->resolvers[$storage];
        }

        $storageConfig = $this->getStorageConfig($storage);

        $adapterName = $storageConfig['adapter'] ?? '';
        if (empty($adapterName)) {
            throw new CloudFileException("adapter not found | [{$storage}]");
        }
        $config = $storageConfig['config'] ?? [];
        if (empty($config)) {
            throw new CloudFileException("config not found | [{$storage}]");
        }
        $config = AdapterName::checkConfig($adapterName, $config);
        $driver = $storageConfig['driver'] ?? '';
        // 如果是自定义的适配器，需要保存能直接 new，目前的支持的 oss、tos 都支持，暂不处理其他的
        if (class_exists($driver)) {
            $adapter = new $driver($config);
        } else {
            $adapter = $this->getAdapter($adapterName, $config);
        }

        $proxy = new FilesystemProxy($this->container, $adapterName, $adapter, $config);
        $proxy->setOptions($storageConfig['options'] ?? []);
        $proxy->setIsPublicRead((bool) ($storageConfig['public_read'] ?? false));
        $this->resolvers[$storage] = $proxy;
        return $proxy;
    }

    public function exist(string $storage): bool
    {
        return isset($this->resolvers[$storage]) || ! empty($this->configs['storages'][$storage]);
    }

    private function getStorageConfig(string $storage): array
    {
        return $this->configs['storages'][$storage] ?? [];
    }

    private function getAdapter(string $adapterName, array $config): FilesystemAdapter
    {
        switch ($adapterName) {
            case AdapterName::FILE_SERVICE:
                $fileServiceApi = new FileServiceApi($this->container, $config);
                return new Kernel\Driver\FileService\FileServiceDriver($fileServiceApi);
            case AdapterName::ALIYUN:
                return new OssAdapter($config);
            case AdapterName::TOS:
                return new Kernel\Driver\TOS\TOSDriver($config);
            case AdapterName::MINIO:
                return new Kernel\Driver\S3\S3Driver($config);
            case AdapterName::LOCAL:
                return new LocalDriver($config);
            default:
                throw new CloudFileException("adapter not found | [{$adapterName}]");
        }
    }
}
