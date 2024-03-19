<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\OSS;

use Dtyq\CloudFile\Kernel\Driver\OSS\OSSImageProcessor;
use Dtyq\CloudFile\Kernel\Struct\ImageProcessOptions;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class OSSImageProcessorTest extends TestCase
{
    private OSSImageProcessor $processor;

    protected function setUp(): void
    {
        $this->processor = new OSSImageProcessor();
    }

    public function testGetParameterName()
    {
        $this->assertEquals('x-oss-process', $this->processor->getParameterName());
    }

    public function testBuildEmptyProcessString()
    {
        $options = new ImageProcessOptions();
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('', $result);
    }

    public function testBuildQualityProcessString()
    {
        $options = (new ImageProcessOptions())->quality(90);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/quality,q_90', $result);
    }

    public function testBuildFormatProcessString()
    {
        $options = (new ImageProcessOptions())->format('webp');
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/format,webp', $result);
    }

    public function testBuildRotateProcessString()
    {
        $options = (new ImageProcessOptions())->rotate(90);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/rotate,90', $result);
    }

    public function testBuildResizeProcessString()
    {
        $options = (new ImageProcessOptions())->resize([
            'width' => 300,
            'height' => 200,
            'mode' => 'lfit',
        ]);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/resize,m_lfit,w_300,h_200', $result);
    }

    public function testBuildResizeWithOnlyWidth()
    {
        $options = (new ImageProcessOptions())->resize(['width' => 800]);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/resize,w_800', $result);
    }

    public function testBuildResizeWithPercentage()
    {
        $options = (new ImageProcessOptions())->resize([
            'percentage' => 50,
        ]);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/resize,p_50', $result);
    }

    public function testBuildCropProcessString()
    {
        $options = (new ImageProcessOptions())->crop([
            'x' => 10,
            'y' => 20,
            'width' => 300,
            'height' => 200,
        ]);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/crop,x_10,y_20,w_300,h_200', $result);
    }

    public function testBuildCropWithGravity()
    {
        $options = (new ImageProcessOptions())->crop([
            'width' => 300,
            'height' => 200,
            'gravity' => 'center',
        ]);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/crop,w_300,h_200,g_center', $result);
    }

    public function testBuildCircleProcessString()
    {
        $options = (new ImageProcessOptions())->circle(100);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/circle,r_100', $result);
    }

    public function testBuildRoundedCornersProcessString()
    {
        $options = (new ImageProcessOptions())->roundedCorners(30);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/rounded-corners,r_30', $result);
    }

    public function testBuildBlurProcessString()
    {
        $options = (new ImageProcessOptions())->blur([
            'radius' => 3,
            'sigma' => 2,
        ]);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/blur,r_3,s_2', $result);
    }

    public function testBuildBrightProcessString()
    {
        $options = (new ImageProcessOptions())->bright(50);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/bright,50', $result);
    }

    public function testBuildContrastProcessString()
    {
        $options = (new ImageProcessOptions())->contrast(30);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/contrast,30', $result);
    }

    public function testBuildSharpenProcessString()
    {
        $options = (new ImageProcessOptions())->sharpen(100);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/sharpen,100', $result);
    }

    public function testBuildTextWatermarkProcessString()
    {
        $options = (new ImageProcessOptions())->watermark([
            'type' => 'text',
            'content' => '版权所有',
            'position' => 'se',
        ]);
        $result = $this->processor->buildProcessString($options);

        $expectedContent = base64_encode('版权所有');
        $this->assertEquals("image/watermark,text_{$expectedContent},g_se", $result);
    }

    public function testBuildImageWatermarkProcessString()
    {
        $options = (new ImageProcessOptions())->watermark([
            'type' => 'image',
            'content' => 'logo.png',
            'position' => 'se',
            'transparency' => 80,
        ]);
        $result = $this->processor->buildProcessString($options);

        $expectedContent = base64_encode('logo.png');
        $this->assertStringContainsString("watermark,image_{$expectedContent}", $result);
        $this->assertStringContainsString('g_se', $result);
        $this->assertStringContainsString('t_80', $result);
    }

    public function testBuildIndexcropProcessString()
    {
        $options = (new ImageProcessOptions())->indexcrop([
            'axis' => 'x',
            'length' => 100,
            'index' => 1,
        ]);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/indexcrop,x_100,i_1', $result);
    }

    public function testBuildAutoOrientProcessString()
    {
        $options = (new ImageProcessOptions())->autoOrient(1);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/auto-orient,1', $result);
    }

    public function testBuildInterlaceProcessString()
    {
        $options = (new ImageProcessOptions())->interlace(1);
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/interlace,1', $result);
    }

    public function testBuildInfoProcessString()
    {
        $options = (new ImageProcessOptions())->info();
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/info', $result);
    }

    public function testBuildAverageHueProcessString()
    {
        $options = (new ImageProcessOptions())->averageHue();
        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/average-hue', $result);
    }

    public function testBuildMultipleOperations()
    {
        $options = (new ImageProcessOptions())
            ->resize(['width' => 800, 'mode' => 'lfit'])
            ->quality(90)
            ->format('webp')
            ->bright(10);

        $result = $this->processor->buildProcessString($options);

        $this->assertEquals('image/resize,m_lfit,w_800/quality,q_90/format,webp/bright,10', $result);
    }

    public function testBuildComplexProcessString()
    {
        $options = (new ImageProcessOptions())
            ->resize(['width' => 800, 'height' => 600, 'mode' => 'lfit'])
            ->quality(85)
            ->format('webp')
            ->watermark([
                'type' => 'text',
                'content' => '水印',
                'position' => 'se',
            ])
            ->bright(5)
            ->contrast(10);

        $result = $this->processor->buildProcessString($options);

        $this->assertStringStartsWith('image/', $result);
        $this->assertStringContainsString('resize,m_lfit,w_800,h_600', $result);
        $this->assertStringContainsString('quality,q_85', $result);
        $this->assertStringContainsString('format,webp', $result);
        $this->assertStringContainsString('watermark', $result);
        $this->assertStringContainsString('bright,5', $result);
        $this->assertStringContainsString('contrast,10', $result);
    }

    public function testRawProcessString()
    {
        $rawString = 'image/resize,w_300/quality,q_90';
        $options = (new ImageProcessOptions())->raw($rawString);

        $result = $this->processor->buildProcessString($options);

        $this->assertEquals($rawString, $result);
    }

    public function testRawProcessStringTakesPrecedence()
    {
        $rawString = 'image/resize,w_500';
        $options = (new ImageProcessOptions())
            ->resize(['width' => 800])
            ->quality(90)
            ->raw($rawString);

        $result = $this->processor->buildProcessString($options);

        // raw 应该优先，忽略其他设置
        $this->assertEquals($rawString, $result);
    }

    // 参数验证测试

    public function testQualityValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('quality must be between 1 and 100');

        (new ImageProcessOptions())->quality(150);
    }

    public function testRotateValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('rotate must be between 0 and 360');

        (new ImageProcessOptions())->rotate(400);
    }

    public function testFormatValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('format must be one of');

        (new ImageProcessOptions())->format('invalid');
    }

    public function testResizeModeValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('resize mode must be one of');

        (new ImageProcessOptions())->resize(['mode' => 'invalid']);
    }

    public function testResizeWidthValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('resize width must be between 1 and 30000');

        (new ImageProcessOptions())->resize(['width' => 50000]);
    }

    public function testBrightValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('bright must be between -100 and 100');

        (new ImageProcessOptions())->bright(-150);
    }

    public function testContrastValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('contrast must be between -100 and 100');

        (new ImageProcessOptions())->contrast(150);
    }

    public function testCircleValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('circle radius must be between 1 and 4096');

        (new ImageProcessOptions())->circle(5000);
    }

    public function testBlurRadiusValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('blur radius must be between 1 and 50');

        (new ImageProcessOptions())->blur(['radius' => 100]);
    }

    public function testCropGravityValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('crop gravity must be one of');

        (new ImageProcessOptions())->crop([
            'width' => 100,
            'height' => 100,
            'gravity' => 'invalid',
        ]);
    }

    public function testWatermarkTypeValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage("watermark type must be 'text' or 'image'");

        (new ImageProcessOptions())->watermark(['type' => 'invalid']);
    }

    public function testAutoOrientValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('autoOrient must be 0 or 1');

        (new ImageProcessOptions())->autoOrient(2);
    }

    public function testInterlaceValidation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('interlace must be 0 or 1');

        (new ImageProcessOptions())->interlace(5);
    }

    // 边界值测试

    public function testQualityBoundary()
    {
        $options1 = (new ImageProcessOptions())->quality(1);
        $this->assertEquals('image/quality,q_1', $this->processor->buildProcessString($options1));

        $options2 = (new ImageProcessOptions())->quality(100);
        $this->assertEquals('image/quality,q_100', $this->processor->buildProcessString($options2));
    }

    public function testBrightBoundary()
    {
        $options1 = (new ImageProcessOptions())->bright(-100);
        $this->assertEquals('image/bright,-100', $this->processor->buildProcessString($options1));

        $options2 = (new ImageProcessOptions())->bright(100);
        $this->assertEquals('image/bright,100', $this->processor->buildProcessString($options2));
    }

    public function testRotateBoundary()
    {
        $options1 = (new ImageProcessOptions())->rotate(0);
        $this->assertEquals('image/rotate,0', $this->processor->buildProcessString($options1));

        $options2 = (new ImageProcessOptions())->rotate(360);
        $this->assertEquals('image/rotate,360', $this->processor->buildProcessString($options2));
    }

    // 格式不区分大小写测试

    public function testFormatCaseInsensitive()
    {
        $options1 = (new ImageProcessOptions())->format('WEBP');
        $this->assertEquals('image/format,WEBP', $this->processor->buildProcessString($options1));

        $options2 = (new ImageProcessOptions())->format('WebP');
        $this->assertEquals('image/format,WebP', $this->processor->buildProcessString($options2));
    }

    // Null 值测试

    public function testNullValuesClearSettings()
    {
        $options = (new ImageProcessOptions())
            ->quality(90)
            ->quality(null);

        $result = $this->processor->buildProcessString($options);
        $this->assertEquals('', $result);
    }
}
