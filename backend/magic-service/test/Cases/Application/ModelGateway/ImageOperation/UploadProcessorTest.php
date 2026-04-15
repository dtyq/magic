<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\ImageOperation;

use App\Application\ModelGateway\Processor\UploadProcessor;
use App\Application\ModelGateway\Struct\ImageProcessContext;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\Image\ImageAsset;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Mockery;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class UploadProcessorTest extends TestCase
{
    private string $tempFilePath = '';

    protected function tearDown(): void
    {
        if ($this->tempFilePath !== '' && is_file($this->tempFilePath)) {
            unlink($this->tempFilePath);
        }

        Mockery::close();
        parent::tearDown();
    }

    public function testProcessUploadsLocalFileAndWritesUploadedResultToContext(): void
    {
        $cloudFileRepository = Mockery::mock(CloudFileRepositoryInterface::class);
        $fileDomainService = new FileDomainService($cloudFileRepository);
        $processor = new UploadProcessor($fileDomainService);

        $this->tempFilePath = tempnam(sys_get_temp_dir(), 'img_upload_');
        file_put_contents($this->tempFilePath, 'fake-image-data');

        $context = new ImageProcessContext(
            asset: ImageAsset::fromLocalFile($this->tempFilePath, 'image/png', 'official_proxy'),
            localFilePath: $this->tempFilePath,
        );
        $context->setOrganizationCode('ORG001');
        $context->setStorageSubDir('open/remove-background');
        $context->setUploadFileNamePrefix('remove_background');

        $cloudFileRepository->shouldReceive('uploadByCredential')
            ->once()
            ->withArgs(function (string $organizationCode, $uploadFile, StorageBucketType $bucketType, bool $autoDir, ?string $contentType): bool {
                return $organizationCode === 'ORG001'
                    && $bucketType === StorageBucketType::Public
                    && $autoDir === true
                    && $contentType === 'image/png';
            })
            ->andReturnUsing(static function (string $organizationCode, $uploadFile): void {
                $uploadFile->setKey('open/test.png');
            });

        $cloudFileRepository->shouldReceive('getLinks')
            ->once()
            ->withArgs(function (string $organizationCode, array $filePaths, ?StorageBucketType $bucketType): bool {
                return $organizationCode === 'ORG001'
                    && count($filePaths) === 1
                    && $bucketType === StorageBucketType::Public;
            })
            ->andReturnUsing(static function (string $organizationCode, array $filePaths): array {
                $path = $filePaths[0];
                return [
                    $path => new FileLink($path, 'https://cdn.example.com/test.png', 3600),
                ];
            });

        $processor->process($context);

        $this->assertSame('https://cdn.example.com/test.png', $context->getUploadedUrl());
        $this->assertSame('image/png', $context->getUploadedMimeType());
        $this->assertSame('official_proxy', $context->getProvider());
    }
}
