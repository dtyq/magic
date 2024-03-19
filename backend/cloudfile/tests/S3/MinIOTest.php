<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\S3;

use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;

/**
 * @internal
 * @coversNothing
 */
class MinIOTest extends CloudFileBaseTest
{
    public function testGetUploadTemporaryCredential(): void
    {
        $filesystem = $this->getFilesystem();

        $simpleCredential = $filesystem->getUploadTemporaryCredential(new CredentialPolicy([
            'sts' => false,
            'roleSessionName' => 'test',
        ]), ['cache' => false]);

        $this->assertArrayHasKey('temporary_credential', $simpleCredential);
        $this->assertSame('minio', $simpleCredential['platform']);
        $this->assertArrayHasKey('signature', $simpleCredential['temporary_credential']);
        $this->assertArrayHasKey('policy', $simpleCredential['temporary_credential']);
        $this->assertArrayHasKey('fields', $simpleCredential['temporary_credential']);
        $this->assertArrayHasKey('access_key_id', $simpleCredential['temporary_credential']);
        $this->assertArrayHasKey('endpoint', $simpleCredential['temporary_credential']);
        $this->assertArrayHasKey('expires', $simpleCredential);

        if ($this->hasRoleArnConfigured()) {
            $stsCredential = $filesystem->getUploadTemporaryCredential(new CredentialPolicy([
                'sts' => true,
                'roleSessionName' => 'test',
            ]), ['cache' => false]);

            $this->assertArrayHasKey('temporary_credential', $stsCredential);
            $this->assertArrayHasKey('sts_token', $stsCredential['temporary_credential']);
            $this->assertArrayHasKey('access_key_id', $stsCredential['temporary_credential']);
            $this->assertArrayHasKey('access_key_secret', $stsCredential['temporary_credential']);
            $this->assertArrayHasKey('credentials', $stsCredential['temporary_credential']);
            $this->assertArrayHasKey('session_token', $stsCredential['temporary_credential']['credentials']);
        } else {
            $this->markTestSkipped('minio_direct 未配置 role_arn，跳过 STS 凭证检查');
        }
    }

    public function testSimpleUpload(): void
    {
        $filesystem = $this->getFilesystem();

        $uploadFile = new UploadFile(__DIR__ . '/../test.txt', 'easy-file');
        $filesystem->uploadByCredential($uploadFile, new CredentialPolicy([
            'sts' => false,
        ]), ['cache' => false]);

        $this->assertTrue(true);
    }

    public function testGetLinks(): void
    {
        $filesystem = $this->getFilesystem();

        $list = $filesystem->getLinks([
            'easy-file/test.txt',
        ], [], 7200, ['cache' => false]);

        $this->assertArrayHasKey('easy-file/test.txt', $list);
    }

    protected function getStorageName(): string
    {
        return 'minio_direct';
    }

    private function hasRoleArnConfigured(): bool
    {
        $configPath = __DIR__ . '/../../storages.json';
        if (! file_exists($configPath)) {
            return false;
        }

        $config = json_decode((string) file_get_contents($configPath), true);

        return ! empty($config['storages']['minio_direct']['config']['role_arn']);
    }
}
