<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\Struct;

use Dtyq\CloudFile\Kernel\Struct\ImageProcessOptions;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class ImageProcessOptionsTest extends TestCase
{
    public function testFromStringWithValidQueryString(): void
    {
        $queryString = 'resize=w:300,h:200,m:lfit&quality=90&format=webp';

        $options = ImageProcessOptions::fromString($queryString);

        $this->assertInstanceOf(ImageProcessOptions::class, $options);
        $this->assertEquals(['width' => 300, 'height' => 200, 'mode' => 'lfit'], $options->getResize());
        $this->assertEquals(90, $options->getQuality());
        $this->assertEquals('webp', $options->getFormat());
    }

    public function testFromStringWithAllParameters(): void
    {
        $queryString = 'resize=w:800,m:lfit&quality=85&format=webp&rotate=90&'
            . 'crop=x:10,y:10,w:100,h:100&circle=75&roundedCorners=20&'
            . 'indexcrop=a:x,l:200,i:1&watermark=t:text,c:Test,p:se&'
            . 'blur=r:10,s:5&sharpen=100&bright=30&contrast=20&'
            . 'info=1&averageHue=1&autoOrient=1&interlace=1';

        $options = ImageProcessOptions::fromString($queryString);

        $this->assertEquals(800, $options->getResize()['width']);
        $this->assertEquals(85, $options->getQuality());
        $this->assertEquals('webp', $options->getFormat());
        $this->assertEquals(90, $options->getRotate());
        $this->assertEquals(100, $options->getCrop()['width']);
        $this->assertEquals(75, $options->getCircle());
        $this->assertEquals(20, $options->getRoundedCorners());
        $this->assertEquals('x', $options->getIndexcrop()['axis']);
        $this->assertEquals('text', $options->getWatermark()['type']);
        $this->assertEquals(10, $options->getBlur()['radius']);
        $this->assertEquals(100, $options->getSharpen());
        $this->assertEquals(30, $options->getBright());
        $this->assertEquals(20, $options->getContrast());
        $this->assertTrue($options->getInfo());
        $this->assertTrue($options->getAverageHue());
        $this->assertEquals(1, $options->getAutoOrient());
        $this->assertEquals(1, $options->getInterlace());
    }

    public function testFromStringValidatesParameters(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('quality must be between 1 and 100');

        $queryString = 'quality=150'; // Invalid: > 100

        ImageProcessOptions::fromString($queryString);
    }

    public function testToString(): void
    {
        $options = (new ImageProcessOptions())
            ->resize(['width' => 300, 'mode' => 'lfit'])
            ->quality(90)
            ->format('webp');

        $queryString = $options->toString();

        $this->assertStringContainsString('resize=w:300', $queryString);
        $this->assertStringContainsString('quality=90', $queryString);
        $this->assertStringContainsString('format=webp', $queryString);
    }

    public function testRoundTripConversion(): void
    {
        $original = (new ImageProcessOptions())
            ->resize(['width' => 800, 'height' => 600, 'mode' => 'fill'])
            ->quality(85)
            ->format('webp')
            ->rotate(90)
            ->bright(10)
            ->contrast(5);

        $queryString = $original->toString();
        $restored = ImageProcessOptions::fromString($queryString);

        $this->assertEquals($original->toArray(), $restored->toArray());
    }

    public function testMagicToString(): void
    {
        $options = (new ImageProcessOptions())
            ->quality(90)
            ->format('webp');

        $queryString = (string) $options;
        $this->assertStringContainsString('quality=90', $queryString);
        $this->assertStringContainsString('format=webp', $queryString);
    }

    public function testFromStringWithRawParameter(): void
    {
        $queryString = 'raw=image/resize,w_300/quality,q_90';

        $options = ImageProcessOptions::fromString($queryString);

        $this->assertStringContainsString('image/resize', $options->getRaw());
    }

    public function testFromStringWithEmptyString(): void
    {
        $queryString = '';

        $options = ImageProcessOptions::fromString($queryString);

        $this->assertInstanceOf(ImageProcessOptions::class, $options);
        $this->assertEmpty($options->toArray());
    }

    public function testFromStringPreservesChineseCharacters(): void
    {
        $queryString = 'watermark=' . urlencode('t:text,c:版权所有');

        $options = ImageProcessOptions::fromString($queryString);

        $this->assertEquals('版权所有', $options->getWatermark()['content']);
    }

    public function testToStringPreservesChineseCharacters(): void
    {
        $options = (new ImageProcessOptions())
            ->watermark([
                'type' => 'text',
                'content' => '版权所有',
            ]);

        $queryString = $options->toString();

        // URL encoded Chinese characters
        $this->assertStringContainsString('watermark=', $queryString);
    }

    public function testToArrayExcludesNullAndFalseValues(): void
    {
        $options = (new ImageProcessOptions())
            ->quality(90)
            ->format('webp')
            ->info(false)
            ->averageHue(false);

        $array = $options->toArray();

        $this->assertArrayHasKey('quality', $array);
        $this->assertArrayHasKey('format', $array);
        $this->assertArrayNotHasKey('info', $array);
        $this->assertArrayNotHasKey('averageHue', $array);
        $this->assertArrayNotHasKey('rotate', $array); // null value
    }

    public function testToArrayIncludesTrueValues(): void
    {
        $options = (new ImageProcessOptions())
            ->info(true)
            ->averageHue(true);

        $array = $options->toArray();

        $this->assertArrayHasKey('info', $array);
        $this->assertArrayHasKey('averageHue', $array);
        $this->assertTrue($array['info']);
        $this->assertTrue($array['averageHue']);
    }
}
