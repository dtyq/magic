<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\OSS;

use Dtyq\CloudFile\Kernel\FilesystemProxy;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;

/**
 * @internal
 * @coversNothing
 */
class OSSTest extends CloudFileBaseTest
{
    public function testGetUploadTemporaryCredential()
    {
        $filesystem = $this->getFilesystem();

        $credentialPolicy = new CredentialPolicy([
            'sts' => false,
            'roleSessionName' => 'test',
        ]);
        $res = $filesystem->getUploadTemporaryCredential($credentialPolicy);
        $this->assertArrayHasKey('temporary_credential', $res);

        $credential = $res['temporary_credential'];
        $this->assertArrayHasKey('signature', $credential);
        $this->assertArrayHasKey('expires', $credential);

        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'roleSessionName' => 'test',
        ]);
        $res = $filesystem->getUploadTemporaryCredential($credentialPolicy);
        $credential = $res['temporary_credential'];
        $this->assertArrayHasKey('sts_token', $credential);
        $this->assertArrayHasKey('expires', $credential);
    }

    public function testUpload()
    {
        $filesystem = $this->getFilesystem();

        $realPath = __DIR__ . '/../test.txt';

        $uploadFile = new UploadFile($realPath, 'easy-file', '', false);
        $filesystem->upload($uploadFile);
        $this->assertTrue(true);
    }

    public function testSimpleUpload()
    {
        $filesystem = $this->getFilesystem();

        $credentialPolicy = new CredentialPolicy([
            'sts' => false,
        ]);

        $realPath = __DIR__ . '/../test.txt';

        $uploadFile = new UploadFile($realPath, 'easy-file');
        $filesystem->uploadByCredential($uploadFile, $credentialPolicy);
        $this->assertTrue(true);
    }

    public function testGetMetadata()
    {
        $filesystem = $this->getFilesystem();

        $fileAttributes = $filesystem->getMetas([
            'easy-file/test.txt',
        ]);
        $this->assertArrayHasKey('easy-file/test.txt', $fileAttributes);
    }

    public function testGetLinks()
    {
        $filesystem = $this->getFilesystem();

        $list = $filesystem->getLinks([
            'easy-file/file-service.txt',
            'easy-file/test.txt',
        ], [], 7200);
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

        $list = $filesystem->getLinks([
            'easy-file/easy.jpeg',
        ], [], 7200, $options);
        var_dump($list);
        $this->assertArrayHasKey('easy-file/easy.jpeg', $list);
    }

    public function testDestroy()
    {
        $filesystem = $this->getFilesystem();

        $realPath = __DIR__ . '/../test.txt';

        $uploadFile = new UploadFile($realPath, 'easy-file', '111.txt', false);
        $path = $filesystem->upload($uploadFile);
        $this->assertEquals('easy-file/111.txt', $path);
        $filesystem->destroy([
            $path,
        ]);
        $this->assertTrue(true);
    }

    public function testDuplicate()
    {
        $filesystem = $this->getFilesystem();

        $path = $filesystem->duplicate('easy-file/test.txt', 'easy-file/test-copy.txt');
        $this->assertIsString($path);
    }

    private function getFilesystem(): FilesystemProxy
    {
        $easyFile = $this->createCloudFile();
        return $easyFile->get('aliyun_test');
    }
}
