<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\ImageOperation;

use App\Application\ModelGateway\Processor\ImageAssetMaterializer;
use App\Application\ModelGateway\Struct\ImageProcessContext;
use App\Infrastructure\ExternalAPI\Image\ImageAsset;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundResult;
use App\Infrastructure\Util\File\SecureImageDownloader;
use App\Infrastructure\Util\File\TemporaryFileManager;
use Mockery;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ImageAssetMaterializerTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testMaterializeReturnsExistingLocalFile(): void
    {
        $downloadTool = Mockery::mock(SecureImageDownloader::class);
        $temporaryFileManager = Mockery::mock(TemporaryFileManager::class);
        $materializer = new ImageAssetMaterializer($downloadTool);

        $providerResult = ImageRemoveBackgroundResult::fromLocalFile(
            '/tmp/provider-result.png',
            'image/png',
            'official_proxy',
        );

        $temporaryFileManager->shouldReceive('add')
            ->once()
            ->with('/tmp/provider-result.png');
        $downloadTool->shouldNotReceive('download');

        $result = $materializer->materialize($providerResult, $temporaryFileManager);

        $this->assertInstanceOf(ImageProcessContext::class, $result);
        $this->assertSame('/tmp/provider-result.png', $result->getLocalFilePath());
        $this->assertSame('image/png', $result->getMimeType());
    }

    public function testMaterializeDownloadsRemoteUrlToLocalFile(): void
    {
        $downloadTool = Mockery::mock(SecureImageDownloader::class);
        $temporaryFileManager = Mockery::mock(TemporaryFileManager::class);
        $materializer = new ImageAssetMaterializer($downloadTool);

        $providerResult = ImageRemoveBackgroundResult::fromRemoteUrl(
            'https://public.example.com/result.png',
            'image/png',
            'official_proxy',
        );

        $downloadTool->shouldReceive('download')
            ->once()
            ->with('https://public.example.com/result.png')
            ->andReturn(ImageAsset::fromLocalFile('/tmp/downloaded-result.png', 'image/png', size: 1024));
        $temporaryFileManager->shouldReceive('add')
            ->once()
            ->with('/tmp/downloaded-result.png');

        $result = $materializer->materialize($providerResult, $temporaryFileManager);

        $this->assertSame('/tmp/downloaded-result.png', $result->getLocalFilePath());
        $this->assertSame('image/png', $result->getMimeType());
    }
}
