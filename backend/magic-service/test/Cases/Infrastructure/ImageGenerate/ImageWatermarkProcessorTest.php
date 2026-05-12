<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ImageGenerate;

use App\Domain\ImageGenerate\Contract\ImageEnhancementProcessorInterface;
use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;
use App\Infrastructure\ImageGenerate\DefaultFontProvider;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use Mockery;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

/**
 * @internal
 */
class ImageWatermarkProcessorTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testProcessLocalFilePreservesTransparentPixelsWhenApplyingVisibleWatermark(): void
    {
        $processor = new ImageWatermarkProcessor();
        $this->injectDependencies($processor);

        $localFilePath = $this->createTransparentPng();

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

    private function injectDependencies(ImageWatermarkProcessor $processor): void
    {
        $fontProviderProperty = new ReflectionProperty(ImageWatermarkProcessor::class, 'fontProvider');
        $fontProviderProperty->setValue($processor, new DefaultFontProvider());

        $imageEnhancementProcessor = Mockery::mock(ImageEnhancementProcessorInterface::class);
        $imageEnhancementProcessor->shouldNotReceive('enhanceImageData');

        $enhancementProcessorProperty = new ReflectionProperty(ImageWatermarkProcessor::class, 'imageEnhancementProcessor');
        $enhancementProcessorProperty->setValue($processor, $imageEnhancementProcessor);
    }

    private function createTransparentPng(): string
    {
        $localFilePath = tempnam(sys_get_temp_dir(), 'watermark_transparent_');
        $this->assertNotFalse($localFilePath);

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

    private function readPixelAlpha(string $localFilePath, int $x, int $y): int
    {
        $image = imagecreatefrompng($localFilePath);
        $this->assertNotFalse($image);

        $rgba = imagecolorat($image, $x, $y);
        imagedestroy($image);

        return ($rgba & 0x7F000000) >> 24;
    }
}
