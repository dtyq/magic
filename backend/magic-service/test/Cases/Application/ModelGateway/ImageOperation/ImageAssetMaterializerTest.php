<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\ImageOperation;

use App\Application\ModelGateway\Processor\ImageAssetMaterializer;
use App\Application\ModelGateway\Struct\ImageProcessContext;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundResult;
use App\Infrastructure\Util\File\ImageFileInspector;
use App\Infrastructure\Util\File\TemporaryFileManager;
use Dtyq\CloudFile\Kernel\Struct\DownloadedRemoteFile;
use Dtyq\CloudFile\Kernel\Utils\SafeRemoteFileDownloader;
use Mockery;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ImageAssetMaterializerTest extends TestCase
{
    /** 1x1 透明 PNG，用于让图片内容校验真正通过。 */
    private const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==';

    private string $tempFilePath = '';

    protected function tearDown(): void
    {
        if ($this->tempFilePath !== '' && is_file($this->tempFilePath)) {
            @unlink($this->tempFilePath);
        }

        Mockery::close();
        parent::tearDown();
    }

    public function testMaterializeReturnsExistingLocalFile(): void
    {
        $downloader = Mockery::mock(SafeRemoteFileDownloader::class);
        $temporaryFileManager = Mockery::mock(TemporaryFileManager::class);
        $materializer = new ImageAssetMaterializer(new ImageFileInspector(), $downloader);

        $providerResult = ImageRemoveBackgroundResult::fromLocalFile(
            '/tmp/provider-result.png',
            'image/png',
            'official_proxy',
        );

        $temporaryFileManager->shouldReceive('add')
            ->once()
            ->with('/tmp/provider-result.png');
        $downloader->shouldNotReceive('download');

        $result = $materializer->materialize($providerResult, $temporaryFileManager);

        $this->assertInstanceOf(ImageProcessContext::class, $result);
        $this->assertSame('/tmp/provider-result.png', $result->getLocalFilePath());
        $this->assertSame('image/png', $result->getMimeType());
        $this->assertSame('official_proxy', $result->getProvider());
    }

    public function testMaterializeDownloadsRemoteUrlToLocalFile(): void
    {
        $this->tempFilePath = tempnam(sys_get_temp_dir(), 'materialize_');
        file_put_contents($this->tempFilePath, base64_decode(self::PNG_BASE64, true));

        $downloader = Mockery::mock(SafeRemoteFileDownloader::class);
        $temporaryFileManager = Mockery::mock(TemporaryFileManager::class);
        $materializer = new ImageAssetMaterializer(new ImageFileInspector(), $downloader);

        $providerResult = ImageRemoveBackgroundResult::fromRemoteUrl(
            'https://public.example.com/result.png',
            'image/png',
            'official_proxy',
        );

        $downloader->shouldReceive('download')
            ->once()
            ->with('https://public.example.com/result.png')
            ->andReturn(new DownloadedRemoteFile($this->tempFilePath, 'result.png', 'image/png', 1024));
        $temporaryFileManager->shouldReceive('add')
            ->once()
            ->with($this->tempFilePath);

        $result = $materializer->materialize($providerResult, $temporaryFileManager);

        $this->assertSame($this->tempFilePath, $result->getLocalFilePath());
        $this->assertSame('image/png', $result->getMimeType());
        $this->assertSame('official_proxy', $result->getProvider());
    }
}
