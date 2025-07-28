<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests;

use Dtyq\CloudFile\CloudFile;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\FilesystemProxy;
use Dtyq\SdkBase\SdkBase;
use Exception;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
abstract class CloudFileBaseTest extends TestCase
{
    public function setUp(): void
    {
        error_reporting(E_ALL ^ E_DEPRECATED);
    }

    public function testCreateCloudFile()
    {
        $cloudFile = $this->createCloudFile();
        $this->assertInstanceOf(CloudFile::class, $cloudFile);
    }

    protected function createCloudFile(): CloudFile
    {
        // 如果要进行测试，需要填写对应的配置，需要真实，这里没有进行 mock
        $configs = [
            'storages' => json_decode(file_get_contents(__DIR__ . '/../storages.json'), true)['storages'] ?? [],
        ];

        $container = new SdkBase(new Container(), [
            'sdk_name' => 'easy_file_sdk',
            'exception_class' => CloudFileException::class,
            'cloudfile' => $configs,
        ]);

        return new CloudFile($container);
    }

    /**
     * Get filesystem instance for testing.
     * Subclasses should implement getStorageName() to define which storage config to use.
     */
    protected function getFilesystem(): FilesystemProxy
    {
        try {
            $easyFile = $this->createCloudFile();
            return $easyFile->get($this->getStorageName());
        } catch (Exception $e) {
            $this->skipTestDueToMissingConfig($this->getStorageName() . ' configuration not available: ' . $e->getMessage());
        }
    }

    /**
     * Get the storage configuration name for this test class.
     * Must be implemented by subclasses.
     */
    abstract protected function getStorageName(): string;

    /**
     * Skip test due to missing configuration.
     *
     * @return never
     */
    protected function skipTestDueToMissingConfig(string $message): void
    {
        $this->markTestSkipped($message);
    }
}
