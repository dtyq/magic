<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\Local;

use Dtyq\CloudFile\Kernel\Driver\Local\LocalExpand;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\FileMetadata;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @covers \Dtyq\CloudFile\Kernel\Driver\Local\LocalExpand
 */
class LocalExpandTest extends TestCase
{
    private string $testRoot;

    private LocalExpand $localExpand;

    protected function setUp(): void
    {
        parent::setUp();
        $this->testRoot = sys_get_temp_dir() . '/cloudfile_test_' . uniqid();
        mkdir($this->testRoot, 0755, true);

        $this->localExpand = new LocalExpand([
            'root' => $this->testRoot,
            'read_host' => 'http://read.example.com',
            'write_host' => 'http://write.example.com',
        ]);
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->testRoot);
        parent::tearDown();
    }

    public function testConstructorWithMissingReadHost(): void
    {
        $this->expectException(CloudFileException::class);
        $this->expectExceptionMessage('read_host is required');

        new LocalExpand([
            'root' => $this->testRoot,
            'write_host' => 'http://write.example.com',
        ]);
    }

    public function testConstructorWithMissingWriteHost(): void
    {
        $this->expectException(CloudFileException::class);
        $this->expectExceptionMessage('write_host is required');

        new LocalExpand([
            'root' => $this->testRoot,
            'read_host' => 'http://read.example.com',
        ]);
    }

    public function testConstructorWithMissingRoot(): void
    {
        $this->expectException(CloudFileException::class);
        $this->expectExceptionMessage('root is required');

        new LocalExpand([
            'read_host' => 'http://read.example.com',
            'write_host' => 'http://write.example.com',
        ]);
    }

    public function testGetUploadCredential(): void
    {
        $credentialPolicy = new CredentialPolicy(['dir' => 'test/dir']);
        $result = $this->localExpand->getUploadCredential($credentialPolicy);

        $this->assertEquals('http://write.example.com', $result['host']);
        $this->assertEquals('test/dir/', $result['dir']);
    }

    public function testGetMetas(): void
    {
        // 创建测试文件
        $testFile = $this->testRoot . '/test.txt';
        file_put_contents($testFile, 'test content');

        $metas = $this->localExpand->getMetas(['test.txt']);

        $this->assertCount(1, $metas);
        $this->assertInstanceOf(FileMetadata::class, $metas[0]);
        $this->assertEquals('test.txt', $metas[0]->getName());
        $this->assertEquals('test.txt', $metas[0]->getPath());

        $attributes = $metas[0]->getFileAttributes();
        $this->assertEquals('text/plain', $attributes->mimeType());
        $this->assertEquals(12, $attributes->fileSize());
    }

    public function testGetFileLinks(): void
    {
        // 创建测试文件
        $testFile = $this->testRoot . '/test.txt';
        file_put_contents($testFile, 'test content');

        $links = $this->localExpand->getFileLinks(['test.txt'], ['custom_name.txt']);

        $this->assertCount(1, $links);
        $firstLink = current($links);
        $this->assertInstanceOf(FileLink::class, $firstLink);
        $this->assertEquals('test.txt', $firstLink->getPath());
        $this->assertEquals('http://read.example.com/test.txt', $firstLink->getUrl());
        $this->assertEquals('custom_name.txt', $firstLink->getDownloadName());
    }

    public function testDestroy(): void
    {
        // 创建测试文件
        $testFile = $this->testRoot . '/test.txt';
        file_put_contents($testFile, 'test content');

        $this->assertTrue(file_exists($testFile));

        $this->localExpand->destroy(['test.txt']);

        $this->assertFalse(file_exists($testFile));
    }

    public function testDuplicate(): void
    {
        // 创建测试文件
        $sourceFile = $this->testRoot . '/test.txt';
        file_put_contents($sourceFile, 'test content');

        $result = $this->localExpand->duplicate('test.txt', 'test_copy.txt');

        $this->assertEquals('test_copy.txt', $result);
        $this->assertTrue(file_exists($this->testRoot . '/test_copy.txt'));
        $this->assertEquals('test content', file_get_contents($this->testRoot . '/test_copy.txt'));
    }

    public function testDuplicateWithNonExistentSource(): void
    {
        $result = $this->localExpand->duplicate('non_existent.txt', 'test_copy.txt');

        $this->assertEquals('', $result);
        $this->assertFalse(file_exists($this->testRoot . '/test_copy.txt'));
    }

    private function removeDirectory(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }

        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            is_dir($path) ? $this->removeDirectory($path) : unlink($path);
        }

        rmdir($dir);
    }
}
