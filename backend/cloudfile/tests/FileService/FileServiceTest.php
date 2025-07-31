<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\FileService;

use Dtyq\CloudFile\Kernel\FilesystemProxy;
use Dtyq\CloudFile\Kernel\Struct\AppendUploadFile;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;
use Exception;

/**
 * @internal
 * @coversNothing
 */
class FileServiceTest extends CloudFileBaseTest
{
    public function testGetUploadTemporaryCredential()
    {
        $filesystem = $this->getFilesystem();

        $credentialPolicy = new CredentialPolicy([
            'sts' => false,
            'roleSessionName' => 'test',
        ]);
        $res = $filesystem->getUploadTemporaryCredential($credentialPolicy, $this->getOptions($filesystem->getOptions()));
        $this->assertArrayHasKey('signature', $res['temporary_credential']);
        $this->assertArrayHasKey('expires', $res['temporary_credential']);

        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'roleSessionName' => 'test',
        ]);
        $res = $filesystem->getUploadTemporaryCredential($credentialPolicy, $this->getOptions($filesystem->getOptions()));
        $this->assertArrayHasKey('sts_token', $res['temporary_credential']);
        $this->assertArrayHasKey('expires', $res['temporary_credential']);
    }

    public function testGetPreSignedUrls()
    {
        $filesystem = $this->getFilesystem($this->getStorageName());

        $list = $filesystem->getPreSignedUrls([
            'easy-file/file-service.txt',
            'easy-file/test.txt',
        ], 3600, $this->getOptions($filesystem->getOptions()));

        $this->assertEmpty($list);
    }

    public function testSimpleUpload()
    {
        $filesystem = $this->getFilesystem();

        $credentialPolicy = new CredentialPolicy([
            'sts' => false,
        ]);

        $realPath = __DIR__ . '/../test.txt';

        $uploadFile = new UploadFile($realPath, 'easy-file');
        $filesystem->uploadByCredential($uploadFile, $credentialPolicy, $this->getOptions($filesystem->getOptions()));
        $this->assertTrue(true);
    }

    public function testSimpleUploadByUrl()
    {
        $filesystem = $this->getFilesystem();

        $list = $filesystem->getLinks([
            'easy-file/file-service.txt',
        ], [], 3600, $this->getOptions($filesystem->getOptions()));
        $this->assertArrayHasKey('easy-file/file-service.txt', $list);
        $link = $list['easy-file/file-service.txt']->getUrl();

        $credentialPolicy = new CredentialPolicy();

        $uploadFile = new UploadFile($link, 'easy-file');
        $filesystem->uploadByCredential($uploadFile, $credentialPolicy, $this->getOptions($filesystem->getOptions()));
        $this->assertTrue(true);
    }

    public function testSimpleUploadByBase64()
    {
        $filesystem = $this->getFilesystem($this->getStorageName());
        $credentialPolicy = new CredentialPolicy();

        $uploadFile = new UploadFile('data:image/jpeg;base64,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', 'easy-file');
        $filesystem->uploadByCredential($uploadFile, $credentialPolicy, $this->getOptions($filesystem->getOptions()));
        $this->assertTrue(true);

        $list = $filesystem->getLinks([
            $uploadFile->getKey(),
        ], [], 7200, $this->getOptions($filesystem->getOptions()));
        var_dump(current($list)->getUrl());
    }

    public function testGetMetas()
    {
        $filesystem = $this->getFilesystem();

        $list = $filesystem->getMetas([
            'easy-file/file-service.txt',
            'easy-file/test.txt',
        ], $this->getOptions($filesystem->getOptions()));
        $this->assertArrayHasKey('easy-file/file-service.txt', $list);
        $this->assertArrayHasKey('easy-file/test.txt', $list);
    }

    public function testGetLinks()
    {
        $filesystem = $this->getFilesystem();

        $list = $filesystem->getLinks([
            'easy-file/file-service.txt',
            'easy-file/test.txt',
        ], [], 7200, $this->getOptions($filesystem->getOptions()));
        $this->assertArrayHasKey('easy-file/file-service.txt', $list);
        $this->assertArrayHasKey('easy-file/test.txt', $list);
    }

    public function testGetInternalLinks()
    {
        $filesystem = $this->getFilesystem();

        $options = $this->getOptions($filesystem->getOptions());
        $options['internal_endpoint'] = true;

        $list = $filesystem->getLinks([
            'easy-file/file-service.txt',
            'easy-file/test.txt',
        ], [], 7200, $options);
        $this->assertArrayHasKey('easy-file/file-service.txt', $list);
        $this->assertArrayHasKey('easy-file/test.txt', $list);
    }

    public function testGetLinksImage()
    {
        $filesystem = $this->getFilesystem();

        $options = [
            'image' => [
                [
                    'type' => 'resize',
                    'params' => [
                        'm' => 'lfit',
                        'l' => 100,
                        's' => 100,
                        'w' => 100,
                        'h' => 100,
                    ],
                ],
            ],
        ];
        $options = array_merge($options, $this->getOptions($filesystem->getOptions()));

        $list = $filesystem->getLinks([
            'easy-file/easy.jpeg',
        ], [], 7200, $options);
        $this->assertArrayHasKey('easy-file/easy.jpeg', $list);
    }

    public function testDestroy()
    {
        $filesystem = $this->getFilesystem();

        $filesystem->destroy([
            'easy-file/file-service.txt',
        ], $this->getOptions($filesystem->getOptions()));
        $this->assertTrue(true);
    }

    public function testDuplicate()
    {
        $filesystem = $this->getFilesystem();

        $path = $filesystem->duplicate('easy-file/test.txt', 'easy-file/test-copy.txt', $this->getOptions($filesystem->getOptions()));
        $this->assertIsString($path);
    }

    public function testAppendUpload()
    {
        $filesystem = $this->getFilesystem();

        // Use timestamp to ensure unique file name
        $testKey = 'easy-file/append-test-' . time() . '-' . uniqid() . '.txt';

        // Now perform append upload using non-STS credentials
        $credentialPolicy = new CredentialPolicy([
            'sts' => false,
        ]);

        $realPath = __DIR__ . '/../test.txt';
        $appendUploadFile = new AppendUploadFile($realPath, 0, $testKey);

        $filesystem->appendUploadByCredential($appendUploadFile, $credentialPolicy, $this->getOptions($filesystem->getOptions()));
        $this->assertTrue(true);
    }

    protected function getStorageName(): string
    {
        return 'file_service_test';
    }

    /**
     * Override base class method to support storage parameter for this test class.
     */
    protected function getFilesystem(?string $storage = null): FilesystemProxy
    {
        if ($storage === null) {
            // Call parent implementation when no parameter provided
            return parent::getFilesystem();
        }

        // Custom implementation with parameter support
        try {
            $easyFile = $this->createCloudFile();
            return $easyFile->get($storage);
        } catch (Exception $e) {
            $this->skipTestDueToMissingConfig($storage . ' configuration not available: ' . $e->getMessage());
        }
    }

    private function getOptions(array $options = []): array
    {
        return array_merge($options, [
            'cache' => false,
        ]);
    }
}
