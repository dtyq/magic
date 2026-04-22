<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageOutputFormatConverter;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 * @covers \App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageOutputFormatConverter
 */
class ImageOutputFormatConverterTest extends BaseTest
{
    // -------------------------------------------------------------------------
    // normalize：统一输出 MIME type 格式
    // -------------------------------------------------------------------------

    public function testNormalizeEmptyStringReturnsEmpty(): void
    {
        $this->assertSame('', ImageOutputFormatConverter::normalize(''));
    }

    public function testNormalizeWhitespaceOnlyReturnsEmpty(): void
    {
        $this->assertSame('', ImageOutputFormatConverter::normalize('   '));
    }

    /** @dataProvider provideNormalizeShortFormat */
    public function testNormalizeShortFormatReturnsMimeType(string $input, string $expected): void
    {
        $this->assertSame($expected, ImageOutputFormatConverter::normalize($input));
    }

    public static function provideNormalizeShortFormat(): array
    {
        return [
            'lowercase png' => ['png', 'image/png'],
            'uppercase PNG' => ['PNG', 'image/png'],
            'mixed case Png' => ['Png', 'image/png'],
            'lowercase jpeg' => ['jpeg', 'image/jpeg'],
            'uppercase JPEG' => ['JPEG', 'image/jpeg'],
            'lowercase webp' => ['webp', 'image/webp'],
            'uppercase WEBP' => ['WEBP', 'image/webp'],
            'lowercase bmp' => ['bmp', 'image/bmp'],
            'lowercase tiff' => ['tiff', 'image/tiff'],
            'lowercase gif' => ['gif', 'image/gif'],
        ];
    }

    /** @dataProvider provideNormalizeJpgAlias */
    public function testNormalizeJpgAliasNormalizedToJpegMimeType(string $input): void
    {
        $this->assertSame('image/jpeg', ImageOutputFormatConverter::normalize($input));
    }

    public static function provideNormalizeJpgAlias(): array
    {
        return [
            'lowercase jpg' => ['jpg'],
            'uppercase JPG' => ['JPG'],
            'mixed case Jpg' => ['Jpg'],
        ];
    }

    /** @dataProvider provideNormalizeMimeTypeInput */
    public function testNormalizeMimeTypeInputReturnsSameMimeType(string $input, string $expected): void
    {
        $this->assertSame($expected, ImageOutputFormatConverter::normalize($input));
    }

    public static function provideNormalizeMimeTypeInput(): array
    {
        return [
            'image/png lowercase' => ['image/png', 'image/png'],
            'image/PNG uppercase' => ['image/PNG', 'image/png'],
            'IMAGE/PNG all upper' => ['IMAGE/PNG', 'image/png'],
            'image/jpeg' => ['image/jpeg', 'image/jpeg'],
            'image/jpg alias' => ['image/jpg', 'image/jpeg'],
            'image/webp' => ['image/webp', 'image/webp'],
            'image/bmp' => ['image/bmp', 'image/bmp'],
            'image/tiff' => ['image/tiff', 'image/tiff'],
            'image/gif' => ['image/gif', 'image/gif'],
        ];
    }

    // -------------------------------------------------------------------------
    // resolveForModel：查配置映射，找不到则抛出异常
    // -------------------------------------------------------------------------

    public function testResolveForModelDoubaoReturnsUppercaseFormat(): void
    {
        $modelConfig = [
            'supported_output_formats' => [
                'image/jpeg' => 'JPG',
                'image/png' => 'PNG',
                'image/webp' => 'WEBP',
            ],
        ];

        $this->assertSame('PNG', ImageOutputFormatConverter::resolveForModel('png', $modelConfig));
        $this->assertSame('PNG', ImageOutputFormatConverter::resolveForModel('PNG', $modelConfig));
        $this->assertSame('PNG', ImageOutputFormatConverter::resolveForModel('image/png', $modelConfig));
        $this->assertSame('PNG', ImageOutputFormatConverter::resolveForModel('IMAGE/PNG', $modelConfig));
        $this->assertSame('JPG', ImageOutputFormatConverter::resolveForModel('jpg', $modelConfig));
        $this->assertSame('JPG', ImageOutputFormatConverter::resolveForModel('jpeg', $modelConfig));
        $this->assertSame('WEBP', ImageOutputFormatConverter::resolveForModel('webp', $modelConfig));
    }

    public function testResolveForModelGoogleReturnsMimeType(): void
    {
        $modelConfig = [
            'supported_output_formats' => [
                'image/jpeg' => 'image/jpeg',
                'image/png' => 'image/png',
                'image/webp' => 'image/webp',
            ],
        ];

        $this->assertSame('image/png', ImageOutputFormatConverter::resolveForModel('png', $modelConfig));
        $this->assertSame('image/png', ImageOutputFormatConverter::resolveForModel('PNG', $modelConfig));
        $this->assertSame('image/png', ImageOutputFormatConverter::resolveForModel('image/png', $modelConfig));
        $this->assertSame('image/jpeg', ImageOutputFormatConverter::resolveForModel('jpg', $modelConfig));
        $this->assertSame('image/jpeg', ImageOutputFormatConverter::resolveForModel('jpeg', $modelConfig));
        $this->assertSame('image/webp', ImageOutputFormatConverter::resolveForModel('webp', $modelConfig));
    }

    public function testResolveForModelThrowsWhenFormatNotSupported(): void
    {
        $this->expectException(BusinessException::class);

        $modelConfig = [
            'supported_output_formats' => [
                'image/jpeg' => 'JPG',
                'image/png' => 'PNG',
            ],
        ];

        ImageOutputFormatConverter::resolveForModel('webp', $modelConfig);
    }

    public function testResolveForModelThrowsWhenNoSupportedFormatsConfig(): void
    {
        $this->expectException(BusinessException::class);

        ImageOutputFormatConverter::resolveForModel('png', []);
    }
}
