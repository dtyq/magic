<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\S3;

use Dtyq\CloudFile\CloudFile;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\FilesystemProxy;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload\S3SimpleUpload;
use Dtyq\CloudFile\Tests\Container;
use Dtyq\SdkBase\SdkBase;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class MinIODirectConfigTest extends TestCase
{
    private CloudFile $cloudFile;

    private SdkBase $container;

    protected function setUp(): void
    {
        parent::setUp();

        $container = new SdkBase(new Container(), [
            'sdk_name' => 'easy_file_sdk',
            'exception_class' => CloudFileException::class,
            'cloudfile' => [
                'storages' => [
                    'minio' => [
                        'adapter' => 'minio',
                        'config' => [
                            'endpoint' => 'http://localhost:9000',
                            'region' => 'us-east-1',
                            'accessKey' => 'test-access-key',
                            'secretKey' => 'test-secret-key',
                            'bucket' => 'test-bucket',
                            'use_path_style_endpoint' => true,
                            'version' => 'latest',
                        ],
                    ],
                ],
            ],
        ]);

        $this->container = $container;
        $this->cloudFile = new CloudFile($container);
    }

    public function testCreateMinIOFilesystem(): void
    {
        $filesystem = $this->cloudFile->get('minio');

        $this->assertInstanceOf(FilesystemProxy::class, $filesystem);
    }

    public function testGetUploadTemporaryCredentialWithoutSts(): void
    {
        $filesystem = $this->cloudFile->get('minio');
        $credentialPolicy = new CredentialPolicy([
            'sts' => false,
            'dir' => 'test-dir',
        ]);

        $credential = $filesystem->getUploadTemporaryCredential($credentialPolicy, ['cache' => false]);

        $this->assertSame('minio', $credential['platform']);
        $this->assertArrayHasKey('temporary_credential', $credential);
        $this->assertArrayHasKey('expires', $credential);

        $temporaryCredential = $credential['temporary_credential'];
        $this->assertSame('http://localhost:9000', $temporaryCredential['endpoint']);
        $this->assertSame('us-east-1', $temporaryCredential['region']);
        $this->assertSame('test-bucket', $temporaryCredential['bucket']);
        $this->assertSame('test-dir/', $temporaryCredential['dir']);
        $this->assertTrue($temporaryCredential['use_path_style_endpoint']);
        $this->assertSame('http://localhost:9000/test-bucket', $temporaryCredential['host']);
        $this->assertSame('http://localhost:9000/test-bucket', $temporaryCredential['url']);
        $this->assertArrayHasKey('signature', $temporaryCredential);
        $this->assertArrayHasKey('policy', $temporaryCredential);
        $this->assertArrayHasKey('fields', $temporaryCredential);
        $this->assertSame($temporaryCredential['signature'], $temporaryCredential['fields']['X-Amz-Signature']);
        $this->assertSame('test-access-key', $temporaryCredential['access_key_id']);
        $this->assertArrayNotHasKey('credentials', $temporaryCredential);
    }

    public function testGetLinksGeneratesPresignedUrl(): void
    {
        $filesystem = $this->cloudFile->get('minio');

        $links = $filesystem->getLinks(['docs/test.txt'], [], 3600, ['cache' => false]);

        $this->assertArrayHasKey('docs/test.txt', $links);
        $url = $links['docs/test.txt']->getUrl();
        $this->assertStringContainsString('http://localhost:9000/test-bucket/docs/test.txt', $url);
        $this->assertStringContainsString('X-Amz-Algorithm', $url);
    }

    public function testGetPreSignedUrlByCredentialRequiresRoleArnInStsMode(): void
    {
        $filesystem = $this->cloudFile->get('minio');

        $this->expectException(CloudFileException::class);
        $this->expectExceptionMessage('未配置role_arn');

        $filesystem->getPreSignedUrlByCredential(new CredentialPolicy(), 'docs/test.txt', ['cache' => false]);
    }

    public function testFlatStsCredentialShapeCanGeneratePresignedUrl(): void
    {
        $simpleUpload = new S3SimpleUpload($this->container);

        $url = $simpleUpload->getPreSignedUrlByCredential([
            'platform' => 'minio',
            'access_key_id' => 'test-access-key',
            'access_key_secret' => 'test-secret-key',
            'sts_token' => 'test-session-token',
            'bucket' => 'test-bucket',
            'region' => 'us-east-1',
            'endpoint' => 'http://localhost:9000',
            'use_path_style_endpoint' => true,
            'version' => 'latest',
        ], 'docs/test.txt', ['expires' => 300]);

        $this->assertStringContainsString('http://localhost:9000/test-bucket/docs/test.txt', $url);
        $this->assertStringContainsString('X-Amz-Security-Token=test-session-token', $url);
    }
}
