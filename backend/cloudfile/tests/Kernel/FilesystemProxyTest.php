<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\Kernel;

use Dtyq\CloudFile\Kernel\AdapterName;
use Dtyq\CloudFile\Kernel\Driver\ExpandInterface;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\FilesystemProxy;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload;
use Dtyq\CloudFile\Tests\Container;
use Dtyq\SdkBase\SdkBase;
use League\Flysystem\FilesystemAdapter;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use ReflectionProperty;
use RuntimeException;

/**
 * FilesystemProxy 批量预签名 URL 测试。
 *
 * @internal
 * @coversNothing
 */
class FilesystemProxyTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    /**
     * 验证批量签名只获取一次凭证，并正确处理选项、非法项和单项失败。
     */
    public function testGetPreSignedUrlsByCredential(): void
    {
        $credentialPolicy = new CredentialPolicy(['expires' => 1800]);
        $credential = [
            'platform' => AdapterName::LOCAL,
            'temporary_credential' => ['token' => 'mock-token'],
            'expires' => time() + 3600,
        ];
        $commonOptions = [
            'default_option' => 'default',
            'expires' => 900,
        ];

        $expand = Mockery::mock(ExpandInterface::class);
        $expand->shouldReceive('getUploadCredential')
            ->once()
            ->with($credentialPolicy, $commonOptions)
            ->andReturn($credential);

        $simpleUpload = Mockery::mock(SimpleUpload::class);
        $simpleUpload->shouldReceive('getPreSignedUrlByCredential')
            ->once()
            ->with(
                $credential,
                'first.txt',
                [
                    'default_option' => 'default',
                    'expires' => 900,
                    'download' => false,
                ]
            )
            ->andReturn('https://example.test/first.txt');
        $simpleUpload->shouldReceive('getPreSignedUrlByCredential')
            ->once()
            ->with($credential, 'failed.txt', $commonOptions)
            ->andThrow(new RuntimeException('mock signing failure'));
        $simpleUpload->shouldReceive('getPreSignedUrlByCredential')
            ->once()
            ->with(
                $credential,
                'third.txt',
                [
                    'default_option' => 'default',
                    'expires' => 120,
                ]
            )
            ->andReturn('https://example.test/third.txt');

        $logger = Mockery::mock(LoggerInterface::class);
        $logger->shouldReceive('error')
            ->once()
            ->withArgs(static function (string $message, array $context): bool {
                return str_contains($message, 'get_presigned_url_by_credential_batch_item_failed')
                    && $context['object_key'] === 'failed.txt'
                    && $context['error'] === 'mock signing failure';
            });

        $container = new Container();
        $container->set(LoggerInterface::class, $logger);
        $sdkContainer = new SdkBase($container, [
            'sdk_name' => 'cloudfile-test',
            'exception_class' => CloudFileException::class,
        ]);

        $filesystem = new FilesystemProxy(
            $sdkContainer,
            AdapterName::LOCAL,
            Mockery::mock(FilesystemAdapter::class),
            [
                'read_host' => 'https://read.example.test',
                'write_host' => 'https://write.example.test',
                'root' => '/tmp/cloudfile-unit-test',
            ]
        );
        $filesystem->setOptions(['default_option' => 'default']);
        $this->setPrivateProperty($filesystem, 'expand', $expand);
        $this->setPrivateProperty($filesystem, 'simpleUploadInstances', [
            AdapterName::LOCAL => $simpleUpload,
        ]);

        $urls = $filesystem->getPreSignedUrlsByCredential(
            $credentialPolicy,
            [
                ['object_key' => 'first.txt', 'options' => ['download' => false]],
                ['object_key' => ''],
                ['object_key' => 123],
                ['object_key' => 'failed.txt'],
                ['object_key' => 'third.txt', 'options' => ['expires' => 120]],
            ],
            ['expires' => 900]
        );

        $this->assertTrue($credentialPolicy->isSts());
        $this->assertSame([
            'first.txt' => 'https://example.test/first.txt',
            'third.txt' => 'https://example.test/third.txt',
        ], $urls);
    }

    /**
     * 设置对象的私有属性，避免单测触发真实存储实现。
     */
    private function setPrivateProperty(object $object, string $propertyName, mixed $value): void
    {
        $property = new ReflectionProperty($object, $propertyName);
        $property->setValue($object, $value);
    }
}
