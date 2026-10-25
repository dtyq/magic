<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ImageGenerate;

use App\Domain\File\Repository\Persistence\CloudFileRepository;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ImageGenerate\Contract\ImageEnhancementProcessorInterface;
use App\Domain\ImageGenerate\ValueObject\ImplicitWatermark;
use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ImageGenerate\DefaultFontProvider;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Mockery;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;
use ReflectionProperty;
use RuntimeException;

/**
 * @internal
 */
class ImageWatermarkProcessorTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    private bool $hadContainer = false;

    /**
     * @var list<string>
     */
    private array $tempFiles = [];

    protected function setUp(): void
    {
        parent::setUp();

        if (! defined('BASE_PATH')) {
            define('BASE_PATH', sys_get_temp_dir() . '/magic-watermark-test-base');
        }

        $this->hadContainer = ApplicationContext::hasContainer();
        $this->previousContainer = $this->hadContainer ? ApplicationContext::getContainer() : null;
    }

    protected function tearDown(): void
    {
        foreach ($this->tempFiles as $tempFile) {
            if (is_file($tempFile)) {
                @unlink($tempFile);
            }
        }
        $this->tempFiles = [];

        if ($this->hadContainer && $this->previousContainer instanceof ContainerInterface) {
            ApplicationContext::setContainer($this->previousContainer);
        } else {
            $property = new ReflectionProperty(ApplicationContext::class, 'container');
            $property->setAccessible(true);
            $property->setValue(null, null);
        }

        $this->previousContainer = null;
        $this->hadContainer = false;

        Mockery::close();
        parent::tearDown();
    }

    public function testProcessLocalFilePreservesTransparentPixelsWhenApplyingVisibleWatermark(): void
    {
        $processor = new ImageWatermarkProcessor();
        $this->injectDependencies($processor);

        $localFilePath = $this->createTransparentPngFile();

        try {
            $this->assertSame(127, $this->readPixelAlpha($localFilePath, 0, 0));

            $processor->processLocalFile(
                $localFilePath,
                new WatermarkConfig('Magic', 9, 0.3),
                null,
            );

            $this->assertSame(127, $this->readPixelAlpha($localFilePath, 0, 0));
        } finally {
            @unlink($localFilePath);
        }
    }

    public function testAddWatermarkToBase64UploadsLocalTempFileAndReturnsUrl(): void
    {
        $pngBytes = $this->createPngBytes();
        $base64Image = 'data:image/png;base64,' . base64_encode($pngBytes);
        $request = $this->createRequest();

        $capturedPath = null;
        $cloudFileRepository = $this->mockSuccessfulUpload(
            expectedBytes: $pngBytes,
            expectedExtension: 'png',
            capturedPath: $capturedPath,
            expectedValidityPeriod: null,
        );

        $processor = $this->createProcessor($cloudFileRepository);
        $result = $processor->addWatermarkToBase64($base64Image, $request);

        $this->assertSame('https://cdn.example.com/open/test.png', $result);
        $this->assertNotNull($capturedPath);
        $this->assertFileDoesNotExist($capturedPath);
    }

    public function testAddWatermarkToBase64SupportsBareBase64Jpeg(): void
    {
        $jpegBytes = $this->createJpegBytes();
        $request = $this->createRequest();

        $capturedPath = null;
        $cloudFileRepository = $this->mockSuccessfulUpload(
            expectedBytes: $jpegBytes,
            expectedExtension: 'jpg',
            capturedPath: $capturedPath,
            expectedValidityPeriod: null,
        );

        $processor = $this->createProcessor($cloudFileRepository);
        $result = $processor->addWatermarkToBase64(base64_encode($jpegBytes), $request);

        $this->assertSame('https://cdn.example.com/open/test.png', $result);
        $this->assertNotNull($capturedPath);
        $this->assertFileDoesNotExist($capturedPath);
    }

    public function testAddWatermarkToUrlUploadsProcessedLocalFile(): void
    {
        $pngBytes = $this->createPngBytes();
        $sourcePath = $this->writeTempFile($pngBytes);
        $request = $this->createRequest();

        $capturedPath = null;
        $cloudFileRepository = $this->mockSuccessfulUpload(
            expectedBytes: $pngBytes,
            expectedExtension: 'png',
            capturedPath: $capturedPath,
            expectedValidityPeriod: 7,
        );
        $request->setValidityPeriod(7);

        $processor = $this->createProcessor($cloudFileRepository);
        $result = $processor->addWatermarkToUrl($sourcePath, $request);

        $this->assertSame('https://cdn.example.com/open/test.png', $result);
        $this->assertNotNull($capturedPath);
        $this->assertFileDoesNotExist($capturedPath);
    }

    public function testVisibleAndImplicitWatermarksAreAppliedInOrderBeforeUpload(): void
    {
        $originalBytes = $this->createPngBytes(40, 40);
        $enhancedBytes = $this->createPngBytes(41, 41);
        $enhancementProcessor = new RecordingImageEnhancementProcessor($enhancedBytes);

        $capturedPath = null;
        $cloudFileRepository = $this->mockSuccessfulUpload(
            expectedBytes: $enhancedBytes,
            expectedExtension: 'png',
            capturedPath: $capturedPath,
            expectedValidityPeriod: null,
            extraUploadAssertions: function (UploadFile $uploadFile) use ($enhancementProcessor): void {
                $enhancementProcessor->markUpload();
                $this->assertFalse(str_starts_with($uploadFile->getRealPath(), 'data:'));
            },
        );

        $request = $this->createRequest();
        $request->setWatermarkConfig(new WatermarkConfig('Magic', 9, 0.3));
        $request->setImplicitWatermark((new ImplicitWatermark())->setUserId('u1')->setOrganizationCode('org'));

        $processor = $this->createProcessor($cloudFileRepository, $enhancementProcessor);
        $result = $processor->addWatermarkToBase64('data:image/png;base64,' . base64_encode($originalBytes), $request);

        $this->assertSame('https://cdn.example.com/open/test.png', $result);
        $this->assertSame(['implicit', 'upload'], $enhancementProcessor->getCallOrder());
        $this->assertNotSame($originalBytes, $enhancementProcessor->getReceivedImageData());
        $this->assertNotNull($capturedPath);
        $this->assertFileDoesNotExist($capturedPath);
    }

    public function testUploadFailureFallsBackToProcessedDataUriAndCleansTempFile(): void
    {
        $pngBytes = $this->createPngBytes();
        $request = $this->createRequest();
        $capturedPath = null;

        $cloudFileRepository = Mockery::mock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->shouldReceive('uploadByCredential')
            ->once()
            ->andReturnUsing(function (
                string $organizationCode,
                UploadFile $uploadFile,
            ) use ($pngBytes, &$capturedPath): void {
                $this->assertSame(CloudFileRepository::DEFAULT_ICON_ORGANIZATION_CODE, $organizationCode);
                $capturedPath = $uploadFile->getRealPath();
                $this->assertFileExists($capturedPath);
                $this->assertSame($pngBytes, file_get_contents($capturedPath));
                throw new RuntimeException('upload failed');
            });
        $cloudFileRepository->shouldReceive('getLinks')->never();
        $cloudFileRepository->shouldReceive('setHeadObjectByCredential')->never();

        $processor = $this->createProcessor($cloudFileRepository);
        $result = $processor->addWatermarkToBase64('data:image/png;base64,' . base64_encode($pngBytes), $request);

        $this->assertSame('data:image/png;base64,' . base64_encode($pngBytes), $result);
        $this->assertNotNull($capturedPath);
        $this->assertFileDoesNotExist($capturedPath);
    }

    public function testMissingLinkFallsBackToProcessedDataUri(): void
    {
        $pngBytes = $this->createPngBytes();
        $request = $this->createRequest();
        $capturedPath = null;

        $cloudFileRepository = Mockery::mock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->shouldReceive('uploadByCredential')
            ->once()
            ->andReturnUsing(function (string $organizationCode, UploadFile $uploadFile) use (&$capturedPath): void {
                $capturedPath = $uploadFile->getRealPath();
                $uploadFile->setKey('MAGIC/open/test.png');
            });
        $cloudFileRepository->shouldReceive('getLinks')
            ->once()
            ->andReturn([]);
        $cloudFileRepository->shouldReceive('setHeadObjectByCredential')->never();

        $processor = $this->createProcessor($cloudFileRepository);
        $result = $processor->addWatermarkToBase64('data:image/png;base64,' . base64_encode($pngBytes), $request);

        $this->assertSame('data:image/png;base64,' . base64_encode($pngBytes), $result);
        $this->assertNotNull($capturedPath);
        $this->assertFileDoesNotExist($capturedPath);
    }

    public function testMetadataFailureFallsBackToProcessedDataUri(): void
    {
        $pngBytes = $this->createPngBytes();
        $request = $this->createRequest();
        $request->setValidityPeriod(3);
        $capturedPath = null;

        $cloudFileRepository = Mockery::mock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->shouldReceive('uploadByCredential')
            ->once()
            ->andReturnUsing(function (string $organizationCode, UploadFile $uploadFile) use (&$capturedPath): void {
                $capturedPath = $uploadFile->getRealPath();
                $uploadFile->setKey('MAGIC/open/test.png');
            });
        $cloudFileRepository->shouldReceive('getLinks')
            ->once()
            ->andReturn([
                'MAGIC/open/test.png' => new FileLink('MAGIC/open/test.png', 'https://cdn.example.com/open/test.png', 3600),
            ]);
        $cloudFileRepository->shouldReceive('setHeadObjectByCredential')
            ->once()
            ->andThrow(new RuntimeException('metadata failed'));

        $processor = $this->createProcessor($cloudFileRepository);
        $result = $processor->addWatermarkToBase64('data:image/png;base64,' . base64_encode($pngBytes), $request);

        $this->assertSame('data:image/png;base64,' . base64_encode($pngBytes), $result);
        $this->assertNotNull($capturedPath);
        $this->assertFileDoesNotExist($capturedPath);
    }

    public function testGifVisibleWatermarkUploadsAsPngAndKeepsGifFallbackPrefix(): void
    {
        $gifBytes = $this->createGifBytes();
        $request = $this->createRequest();
        $request->setWatermarkConfig(new WatermarkConfig('Magic', 9, 0.3));

        $capturedPath = null;
        $capturedUploadBytes = null;
        $cloudFileRepository = Mockery::mock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->shouldReceive('uploadByCredential')
            ->once()
            ->andReturnUsing(function (string $organizationCode, UploadFile $uploadFile) use (&$capturedPath, &$capturedUploadBytes): void {
                $capturedPath = $uploadFile->getRealPath();
                $capturedUploadBytes = file_get_contents($capturedPath);
                $this->assertMatchesRegularExpression('/\.png$/i', $uploadFile->getName());
                $info = getimagesizefromstring($capturedUploadBytes);
                $this->assertNotFalse($info);
                $this->assertSame(IMAGETYPE_PNG, $info[2]);
                $uploadFile->setKey('MAGIC/open/test.png');
            });
        $cloudFileRepository->shouldReceive('getLinks')
            ->once()
            ->andReturn([
                'MAGIC/open/test.png' => new FileLink('MAGIC/open/test.png', 'https://cdn.example.com/open/test.png', 3600),
            ]);
        $cloudFileRepository->shouldReceive('setHeadObjectByCredential')
            ->once()
            ->andReturnNull();

        $processor = $this->createProcessor($cloudFileRepository);
        $result = $processor->addWatermarkToBase64('data:image/gif;base64,' . base64_encode($gifBytes), $request);

        $this->assertSame('https://cdn.example.com/open/test.png', $result);
        $this->assertNotNull($capturedUploadBytes);
        $this->assertNotNull($capturedPath);
        $this->assertFileDoesNotExist($capturedPath);

        // Force metadata failure path semantics for GIF fallback prefix via a dedicated failure case.
        $fallbackRepository = Mockery::mock(CloudFileRepositoryInterface::class);
        $fallbackRepository->shouldReceive('uploadByCredential')
            ->once()
            ->andThrow(new RuntimeException('upload failed'));
        $fallbackProcessor = $this->createProcessor($fallbackRepository);
        $fallback = $fallbackProcessor->addWatermarkToBase64('data:image/gif;base64,' . base64_encode($gifBytes), $request);

        $this->assertStringStartsWith('data:image/gif;base64,', $fallback);
        $decoded = base64_decode(substr($fallback, strlen('data:image/gif;base64,')), true);
        $this->assertNotFalse($decoded);
        $decodedInfo = getimagesizefromstring($decoded);
        $this->assertNotFalse($decodedInfo);
        $this->assertSame(IMAGETYPE_PNG, $decodedInfo[2]);
    }

    public function testConsecutiveUploadsDoNotShareTemporaryFiles(): void
    {
        $firstBytes = $this->createPngBytes(20, 20);
        $secondBytes = $this->createPngBytes(21, 21);
        $capturedPaths = [];

        $cloudFileRepository = Mockery::mock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->shouldReceive('uploadByCredential')
            ->twice()
            ->andReturnUsing(function (string $organizationCode, UploadFile $uploadFile) use (&$capturedPaths): void {
                $path = $uploadFile->getRealPath();
                $this->assertFileExists($path);
                $capturedPaths[] = $path;
                $uploadFile->setKey('MAGIC/open/test.png');
            });
        $cloudFileRepository->shouldReceive('getLinks')
            ->twice()
            ->andReturn([
                'MAGIC/open/test.png' => new FileLink('MAGIC/open/test.png', 'https://cdn.example.com/open/test.png', 3600),
            ]);
        $cloudFileRepository->shouldReceive('setHeadObjectByCredential')
            ->twice()
            ->andReturnNull();

        $processor = $this->createProcessor($cloudFileRepository);
        $request = $this->createRequest();

        $this->assertSame(
            'https://cdn.example.com/open/test.png',
            $processor->addWatermarkToBase64('data:image/png;base64,' . base64_encode($firstBytes), $request)
        );
        $this->assertSame(
            'https://cdn.example.com/open/test.png',
            $processor->addWatermarkToBase64('data:image/png;base64,' . base64_encode($secondBytes), $request)
        );

        $this->assertCount(2, $capturedPaths);
        $this->assertNotSame($capturedPaths[0], $capturedPaths[1]);
        $this->assertFileDoesNotExist($capturedPaths[0]);
        $this->assertFileDoesNotExist($capturedPaths[1]);
    }

    private function createProcessor(
        CloudFileRepositoryInterface $cloudFileRepository,
        ?ImageEnhancementProcessorInterface $enhancementProcessor = null,
    ): ImageWatermarkProcessor {
        $loggerFactory = Mockery::mock(LoggerFactory::class);
        $loggerFactory->shouldReceive('get')->andReturn(new NullLogger());

        $fileDomainService = new FileDomainService($cloudFileRepository);
        ApplicationContext::setContainer($this->createContainer([
            FileDomainService::class => $fileDomainService,
            LoggerFactory::class => $loggerFactory,
        ]));

        $processor = new ImageWatermarkProcessor();
        $this->injectDependencies($processor, $enhancementProcessor);
        $processor->logger = new NullLogger();

        return $processor;
    }

    /**
     * @param null|callable(UploadFile):void $extraUploadAssertions
     */
    private function mockSuccessfulUpload(
        string $expectedBytes,
        string $expectedExtension,
        ?string &$capturedPath,
        ?int $expectedValidityPeriod,
        ?callable $extraUploadAssertions = null,
    ): CloudFileRepositoryInterface {
        $cloudFileRepository = Mockery::mock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->shouldReceive('uploadByCredential')
            ->once()
            ->withArgs(function (
                string $organizationCode,
                UploadFile $uploadFile,
                StorageBucketType $bucketType,
                bool $autoDir,
            ) use ($expectedBytes, $expectedExtension, &$capturedPath, $extraUploadAssertions): bool {
                $capturedPath = $uploadFile->getRealPath();
                $this->assertSame(CloudFileRepository::DEFAULT_ICON_ORGANIZATION_CODE, $organizationCode);
                $this->assertSame(StorageBucketType::Public, $bucketType);
                $this->assertTrue($autoDir);
                $this->assertFileExists($capturedPath);
                $this->assertSame($expectedBytes, file_get_contents($capturedPath));
                $this->assertFalse(str_starts_with($capturedPath, 'data:'));
                $this->assertMatchesRegularExpression('/\.' . preg_quote($expectedExtension, '/') . '$/i', $uploadFile->getName());
                if ($extraUploadAssertions !== null) {
                    $extraUploadAssertions($uploadFile);
                }
                return true;
            })
            ->andReturnUsing(static function (string $organizationCode, UploadFile $uploadFile): void {
                $uploadFile->setKey('MAGIC/open/test.png');
            });

        $cloudFileRepository->shouldReceive('getLinks')
            ->once()
            ->andReturn([
                'MAGIC/open/test.png' => new FileLink('MAGIC/open/test.png', 'https://cdn.example.com/open/test.png', 3600),
            ]);

        $cloudFileRepository->shouldReceive('setHeadObjectByCredential')
            ->once()
            ->withArgs(function (
                string $organizationCode,
                string $objectKey,
                array $metadata,
                StorageBucketType $bucketType,
            ) use ($expectedValidityPeriod): bool {
                $this->assertSame(CloudFileRepository::DEFAULT_ICON_ORGANIZATION_CODE, $organizationCode);
                $this->assertSame('MAGIC/open/test.png', $objectKey);
                $this->assertSame(StorageBucketType::Public, $bucketType);
                $this->assertArrayHasKey('metadata', $metadata);
                $decoded = json_decode($metadata['metadata'], true);
                $this->assertIsArray($decoded);
                if ($expectedValidityPeriod === null) {
                    $this->assertSame([], $decoded);
                } else {
                    $this->assertSame(['validity_period' => (string) $expectedValidityPeriod], $decoded);
                }
                return true;
            })
            ->andReturnNull();

        return $cloudFileRepository;
    }

    private function injectDependencies(
        ImageWatermarkProcessor $processor,
        ?ImageEnhancementProcessorInterface $enhancementProcessor = null,
    ): void {
        $fontProviderProperty = new ReflectionProperty(ImageWatermarkProcessor::class, 'fontProvider');
        $fontProviderProperty->setValue($processor, new DefaultFontProvider());

        if ($enhancementProcessor === null) {
            $enhancementProcessor = Mockery::mock(ImageEnhancementProcessorInterface::class);
            $enhancementProcessor->shouldReceive('enhanceImageData')->never();
        }

        $enhancementProcessorProperty = new ReflectionProperty(ImageWatermarkProcessor::class, 'imageEnhancementProcessor');
        $enhancementProcessorProperty->setValue($processor, $enhancementProcessor);
    }

    private function createRequest(): ImageGenerateRequest
    {
        return new ImageGenerateRequest('64', '64', 'cat', '', 'test-model');
    }

    /**
     * @param array<string, mixed> $definitions
     */
    private function createContainer(array $definitions): ContainerInterface
    {
        return new class($definitions) implements ContainerInterface {
            /**
             * @param array<string, mixed> $definitions
             */
            public function __construct(private array $definitions)
            {
            }

            public function get(string $id): mixed
            {
                if (! array_key_exists($id, $this->definitions)) {
                    throw new RuntimeException(sprintf('Service not found: %s', $id));
                }

                return $this->definitions[$id];
            }

            public function has(string $id): bool
            {
                return array_key_exists($id, $this->definitions);
            }
        };
    }

    private function createTransparentPngFile(): string
    {
        $localFilePath = tempnam(sys_get_temp_dir(), 'watermark_transparent_');
        $this->assertNotFalse($localFilePath);
        $this->tempFiles[] = $localFilePath;

        $image = imagecreatetruecolor(200, 200);
        $this->assertNotFalse($image);

        imagealphablending($image, false);
        imagesavealpha($image, true);

        $transparent = imagecolorallocatealpha($image, 0, 0, 0, 127);
        imagefill($image, 0, 0, $transparent);

        $solidRed = imagecolorallocatealpha($image, 255, 0, 0, 0);
        imagefilledrectangle($image, 70, 70, 130, 130, $solidRed);

        imagepng($image, $localFilePath);
        imagedestroy($image);

        return $localFilePath;
    }

    private function createPngBytes(int $width = 32, int $height = 32): string
    {
        $image = imagecreatetruecolor($width, $height);
        $this->assertNotFalse($image);
        imagealphablending($image, false);
        imagesavealpha($image, true);
        $transparent = imagecolorallocatealpha($image, 0, 0, 0, 127);
        imagefill($image, 0, 0, $transparent);
        $red = imagecolorallocatealpha($image, 255, 0, 0, 0);
        imagefilledrectangle($image, 4, 4, max(5, $width - 5), max(5, $height - 5), $red);

        ob_start();
        imagepng($image);
        $bytes = ob_get_clean();
        imagedestroy($image);
        $this->assertNotFalse($bytes);

        return $bytes;
    }

    private function createJpegBytes(): string
    {
        $image = imagecreatetruecolor(32, 32);
        $this->assertNotFalse($image);
        $white = imagecolorallocate($image, 255, 255, 255);
        imagefill($image, 0, 0, $white);

        ob_start();
        imagejpeg($image, null, 90);
        $bytes = ob_get_clean();
        imagedestroy($image);
        $this->assertNotFalse($bytes);

        return $bytes;
    }

    private function createGifBytes(): string
    {
        $image = imagecreatetruecolor(32, 32);
        $this->assertNotFalse($image);
        $white = imagecolorallocate($image, 255, 255, 255);
        imagefill($image, 0, 0, $white);

        ob_start();
        imagegif($image);
        $bytes = ob_get_clean();
        imagedestroy($image);
        $this->assertNotFalse($bytes);

        return $bytes;
    }

    private function writeTempFile(string $bytes): string
    {
        $path = tempnam(sys_get_temp_dir(), 'watermark_src_');
        $this->assertNotFalse($path);
        $this->tempFiles[] = $path;
        file_put_contents($path, $bytes);

        return $path;
    }

    private function readPixelAlpha(string $localFilePath, int $x, int $y): int
    {
        $image = imagecreatefrompng($localFilePath);
        $this->assertNotFalse($image);

        $rgba = imagecolorat($image, $x, $y);
        imagedestroy($image);

        return ($rgba & 0x7F000000) >> 24;
    }
}

/**
 * Test double that mutates image bytes by reference and records call order.
 */
class RecordingImageEnhancementProcessor implements ImageEnhancementProcessorInterface
{
    /**
     * @var list<string>
     */
    private array $callOrder = [];

    private string $receivedImageData = '';

    public function __construct(private readonly string $replacementBytes)
    {
    }

    public function enhanceImageData(string &$imageData, ImplicitWatermark $watermark): void
    {
        $this->callOrder[] = 'implicit';
        $this->receivedImageData = $imageData;
        $imageData = $this->replacementBytes;
    }

    public function enhanceImageUrl(string $imageUrl, ImplicitWatermark $watermark): string
    {
        return $imageUrl;
    }

    public function extractEnhancementFromImageData(string $imageData): ?array
    {
        return null;
    }

    public function markUpload(): void
    {
        $this->callOrder[] = 'upload';
    }

    /**
     * @return list<string>
     */
    public function getCallOrder(): array
    {
        return $this->callOrder;
    }

    public function getReceivedImageData(): string
    {
        return $this->receivedImageData;
    }
}
