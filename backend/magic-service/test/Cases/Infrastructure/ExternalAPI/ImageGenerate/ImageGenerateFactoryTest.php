<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateFactory;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\GoogleGeminiRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\VolcengineArk\VolcengineArkRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\AzureOpenAIImageRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\FluxModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\MidjourneyModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\QwenImageModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\VolcengineModelRequest;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 * @covers \App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateFactory
 * @covers \App\Infrastructure\ExternalAPI\ImageGenerateAPI\SizeManager
 */
class ImageGenerateFactoryTest extends BaseTest
{
    /**
     * 测试使用配置文件中存在的模型版本进行精确label匹配
     * 使用 gemini-2.5-flash-image 配置.
     */
    public function testCreateRequestWithExactLabelMatch()
    {
        $data = $this->getCommonData();
        $data['size'] = '1:1';

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::GoogleGemini,
            'gemini-2.5-flash-image',
            null,
            $data
        );

        $this->assertInstanceOf(GoogleGeminiRequest::class, $request);
        $this->assertEquals('1024', $request->getWidth());
        $this->assertEquals('1024', $request->getHeight());
        $this->assertEquals('1:1', $request->getRatio());
        // gemini-2.5-flash-image 不支持 resolution preset
        $this->assertNull($request->getResolutionPreset());
    }

    /**
     * 测试使用配置文件中存在的模型版本进行精确value匹配
     * 使用 gemini-2.5-flash-image 配置.
     */
    public function testCreateRequestWithExactValueMatch()
    {
        $data = $this->getCommonData();
        $data['size'] = '1820x1024'; // 16:9 from gemini-2.5 config

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::GoogleGemini,
            'gemini-2.5-flash-image',
            null,
            $data
        );

        $this->assertInstanceOf(GoogleGeminiRequest::class, $request);
        $this->assertEquals('1820', $request->getWidth());
        $this->assertEquals('1024', $request->getHeight());
    }

    /**
     * 测试使用model_id匹配配置
     * 使用 seedream-4-0 model_id 配置.
     */
    public function testCreateRequestWithModelIdMatch()
    {
        $data = $this->getCommonData();
        $data['size'] = '1:1';

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::VolcengineArk,
            'unknown-version',
            'seedream-4-0',
            $data
        );

        $this->assertInstanceOf(VolcengineArkRequest::class, $request);
        $this->assertEquals('2048', $request->getWidth());
        $this->assertEquals('2048', $request->getHeight());
    }

    /**
     * 测试最接近比例匹配
     * 16:10 (1.6) 应该匹配到 3:2 (1.5)，因为 1.6 - 1.5 = 0.1 < 1.777 - 1.6 = 0.177
     * 使用 gemini-2.5-flash-image 配置.
     */
    public function testCreateRequestWithClosestRatioMatch()
    {
        $data = $this->getCommonData();
        $data['size'] = '16:10'; // 比例 1.6，应该匹配到 3:2 (1.5)

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::GoogleGemini,
            'gemini-2.5-flash-image',
            null,
            $data
        );

        $this->assertInstanceOf(GoogleGeminiRequest::class, $request);
        // 16:10 (1.6) 应该匹配到最接近的 3:2 (1.5) -> 1536x1024
        $this->assertEquals('1536', $request->getWidth());
        $this->assertEquals('1024', $request->getHeight());
    }

    /**
     * 测试当没有匹配到配置时，使用任意尺寸
     * 应该使用默认的 parseToWidthHeight 逻辑.
     */
    public function testCreateRequestWithArbitrarySizeWhenNoConfigMatch()
    {
        $data = $this->getCommonData();
        $data['size'] = '123x456';

        // Using a version that doesn't match any config
        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::Volcengine,
            'unknown-model-version',
            'unknown-id',
            $data
        );

        $this->assertInstanceOf(VolcengineModelRequest::class, $request);
        $this->assertEquals('123', $request->getWidth());
        $this->assertEquals('456', $request->getHeight());
    }

    /**
     * 测试 Azure OpenAI Image Generate 请求创建
     * 使用配置文件中 AzureOpenAI-ImageGenerate 的配置.
     */
    public function testAzureOpenAIImageGenerateRequest()
    {
        $data = $this->getCommonData();
        $data['size'] = '2:3'; // 应该匹配到 1024x1536
        $data['quality'] = 'hd';

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::AzureOpenAIImageGenerate,
            'AzureOpenAI-ImageGenerate',
            null,
            $data
        );

        $this->assertInstanceOf(AzureOpenAIImageRequest::class, $request);
        $this->assertEquals('1024', $request->getWidth());
        $this->assertEquals('1536', $request->getHeight());
        $this->assertEquals('1024x1536', $request->getSize());
    }

    public function testAzureGptImage2RejectsSizesThatAreNotDivisibleBy16(): void
    {
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ImageGenerateErrorCode::UNSUPPORTED_IMAGE_SIZE->value);

        $data = $this->getCommonData();
        $data['size'] = '819x1024';

        ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::AzureOpenAIImageGenerate,
            'gpt-image-2',
            null,
            $data
        );
    }

    /**
     * 测试 Azure OpenAI Image Edit 请求创建
     * 使用配置文件中 AzureOpenAI-ImageEdit 的配置.
     */
    public function testAzureOpenAIImageEditRequest()
    {
        $data = $this->getCommonData();
        $data['size'] = '1:1'; // 应该匹配到 1024x1024
        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::AzureOpenAIImageEdit,
            'AzureOpenAI-ImageEdit',
            null,
            $data
        );

        $this->assertInstanceOf(AzureOpenAIImageRequest::class, $request);
        $this->assertEquals('1024', $request->getWidth());
        $this->assertEquals('1024', $request->getHeight());
        $this->assertEquals('1024x1024', $request->getSize());
    }

    /**
     * 测试 Google Gemini 请求创建
     * 使用配置文件中 gemini-2.5-flash-image 的配置.
     */
    public function testGoogleGeminiRequest()
    {
        $data = $this->getCommonData();
        $data['size'] = '16:9'; // 应该匹配到 1820x1024

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::GoogleGemini,
            'gemini-2.5-flash-image',
            null,
            $data
        );

        $this->assertInstanceOf(GoogleGeminiRequest::class, $request);
        $this->assertEquals('1820', $request->getWidth());
        $this->assertEquals('1024', $request->getHeight());
        $this->assertEquals('1820x1024', $request->getSize());
        $this->assertEquals('16:9', $request->getRatio());
    }

    /**
     * 测试 Qwen Image 请求创建
     * 使用配置文件中 qwen-image 的配置.
     */
    public function testQwenImageRequest()
    {
        $data = $this->getCommonData();
        $data['size'] = '1:1'; // 应该匹配到 1328x1328

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::QwenImage,
            'qwen-image',
            null,
            $data
        );

        $this->assertInstanceOf(QwenImageModelRequest::class, $request);
        $this->assertEquals('1328', $request->getWidth());
        $this->assertEquals('1328', $request->getHeight());
    }

    /**
     * 测试使用比例格式但不在配置中的情况
     * 应该使用最接近的比例匹配.
     */
    public function testCreateRequestWithRatioNotInConfig()
    {
        $data = $this->getCommonData();
        $data['size'] = '5:3'; // 比例 1.67，不在配置中，应该匹配到最接近的

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::GoogleGemini,
            'gemini-2.5-flash-image',
            null,
            $data
        );

        $this->assertInstanceOf(GoogleGeminiRequest::class, $request);
        // 5:3 (1.67) 应该匹配到最接近的 16:9 (1.77) -> 1820x1024
        $this->assertEquals('1820', $request->getWidth());
        $this->assertEquals('1024', $request->getHeight());
    }

    /**
     * 测试使用 k 格式的尺寸（2k, 3k等）
     * 当没有匹配到配置时，应该使用默认解析逻辑.
     */
    public function testCreateRequestWithKFormat()
    {
        $data = $this->getCommonData();
        $data['size'] = '2k'; // 应该解析为 2048x2048

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::Volcengine,
            'unknown-version',
            null,
            $data
        );

        $this->assertInstanceOf(VolcengineModelRequest::class, $request);
        $this->assertEquals('2048', $request->getWidth());
        $this->assertEquals('2048', $request->getHeight());
    }

    /**
     * 测试使用 3k 格式的尺寸
     * 应该解析为 3072x3072.
     */
    public function testCreateRequestWith3KFormat()
    {
        $data = $this->getCommonData();
        $data['size'] = '3k'; // 应该解析为 3072x3072

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::Volcengine,
            'unknown-version',
            null,
            $data
        );

        $this->assertInstanceOf(VolcengineModelRequest::class, $request);
        $this->assertEquals('3072', $request->getWidth());
        $this->assertEquals('3072', $request->getHeight());
    }

    /**
     * 测试使用标准格式 1024x1024
     * 当没有匹配到配置时，应该直接解析为宽高.
     */
    public function testCreateRequestWith1024x1024Format()
    {
        $data = $this->getCommonData();
        $data['size'] = '1024x1024';

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::Volcengine,
            'unknown-version',
            null,
            $data
        );

        $this->assertInstanceOf(VolcengineModelRequest::class, $request);
        $this->assertEquals('1024', $request->getWidth());
        $this->assertEquals('1024', $request->getHeight());
    }

    /**
     * 测试使用 seedream-4-5 model_id 配置
     * 该配置有多个相同label但不同scale的选项.
     */
    public function testCreateRequestWithSeedream45Config()
    {
        $data = $this->getCommonData();
        $data['size'] = '1:1'; // 应该匹配到第一个 1:1 -> 2048x2048 (2X)

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::VolcengineArk,
            'unknown-version',
            'seedream-4-5',
            $data
        );

        $this->assertInstanceOf(VolcengineArkRequest::class, $request);
        // 匹配到第一个 1:1 配置
        $this->assertEquals('2048', $request->getWidth());
        $this->assertEquals('2048', $request->getHeight());
    }

    /**
     * 测试 Midjourney 请求创建
     * Midjourney 使用 SizeManager 解析尺寸并计算比例.
     */
    public function testMidjourneyRequest()
    {
        $data = $this->getCommonData();
        $data['size'] = '16:9';
        $data['model'] = 'Midjourney-Fast';

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::Midjourney,
            'gemini-2.5-flash-image', // 使用有配置的版本
            null,
            $data
        );

        $this->assertInstanceOf(MidjourneyModelRequest::class, $request);
        // 应该匹配到 16:9 -> 1820x1024
        $this->assertEquals('1820', $request->getWidth());
        $this->assertEquals('1024', $request->getHeight());
        // Midjourney 使用 calculateRatio 计算最简比例，1820x1024 的最简比例是 455:256
        $this->assertEquals('455:256', $request->getRatio());
    }

    /**
     * 测试 Flux 请求创建
     * Flux 有特殊的尺寸限制逻辑.
     */
    public function testFluxRequest()
    {
        $data = $this->getCommonData();
        $data['size'] = '1:1';
        $data['model'] = 'flux1-pro';

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::Flux,
            'gemini-2.5-flash-image', // 使用有配置的版本
            null,
            $data
        );

        $this->assertInstanceOf(FluxModelRequest::class, $request);
        // Flux 会验证尺寸，如果不是支持的尺寸会回退到 1024x1024
        // 1:1 匹配到 1024x1024，这是支持的尺寸
        $this->assertEquals('1024', $request->getWidth());
        $this->assertEquals('1024', $request->getHeight());
    }

    /**
     * 测试空尺寸字符串时使用默认值
     */
    public function testCreateRequestWithEmptySize()
    {
        $data = $this->getCommonData();
        $data['size'] = ''; // 空字符串

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::Volcengine,
            'unknown-version',
            null,
            $data
        );

        $this->assertInstanceOf(VolcengineModelRequest::class, $request);
        // 应该使用默认值 1024x1024
        $this->assertEquals('1024', $request->getWidth());
        $this->assertEquals('1024', $request->getHeight());
    }

    /**
     * 测试使用乘号格式的尺寸 (1024*1024).
     */
    public function testCreateRequestWithAsteriskFormat()
    {
        $data = $this->getCommonData();
        $data['size'] = '1024*1024';

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::Volcengine,
            'unknown-version',
            null,
            $data
        );

        $this->assertInstanceOf(VolcengineModelRequest::class, $request);
        $this->assertEquals('1024', $request->getWidth());
        $this->assertEquals('1024', $request->getHeight());
    }

    /**
     * 测试 gemini-3-pro-image-preview 配置
     * 该配置有更多尺寸选项.
     */
    public function testGoogleGemini3ProRequest()
    {
        $data = $this->getCommonData();
        $data['size'] = '21:9'; // 应该匹配到 1584x672 (1K)

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::GoogleGemini,
            'gemini-3-pro-image-preview',
            null,
            $data
        );

        $this->assertInstanceOf(GoogleGeminiRequest::class, $request);
        $this->assertEquals('1584', $request->getWidth());
        $this->assertEquals('672', $request->getHeight());
        $this->assertEquals('1584x672', $request->getSize());
        $this->assertEquals('21:9', $request->getRatio());
        $this->assertEquals('1K', $request->getResolutionPreset());
    }

    /**
     * 测试 gemini-3-pro-image-preview 2K 配置.
     */
    public function testGoogleGemini3ProRequest2K()
    {
        $data = $this->getCommonData();
        $data['size'] = '3168x1344'; // 21:9 2K

        $request = ImageGenerateFactory::createRequestType(
            ImageGenerateModelType::GoogleGemini,
            'gemini-3-pro-image-preview',
            null,
            $data
        );

        $this->assertInstanceOf(GoogleGeminiRequest::class, $request);
        $this->assertEquals('3168', $request->getWidth());
        $this->assertEquals('1344', $request->getHeight());
        $this->assertEquals('21:9', $request->getRatio());
        $this->assertEquals('2K', $request->getResolutionPreset());
    }

    // ==========================================================
    // Gemini 3 Pro Image Preview - 所有尺寸测试
    // ==========================================================

    /**
     * 测试 gemini-3-pro-image-preview 1:1 所有分辨率.
     */
    public function testGoogleGemini3ProAll1To1Sizes()
    {
        $sizes = [
            ['size' => '1:1', 'width' => '1024', 'height' => '1024', 'ratio' => '1:1', 'preset' => '1K'],
            ['size' => '1024x1024', 'width' => '1024', 'height' => '1024', 'ratio' => '1:1', 'preset' => '1K'],
            ['size' => '2048x2048', 'width' => '2048', 'height' => '2048', 'ratio' => '1:1', 'preset' => '2K'],
            ['size' => '4096x4096', 'width' => '4096', 'height' => '4096', 'ratio' => '1:1', 'preset' => '4K'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::GoogleGemini,
                'gemini-3-pro-image-preview',
                null,
                $data
            );

            $this->assertInstanceOf(GoogleGeminiRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['ratio'], $request->getRatio(), "Ratio mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['preset'], $request->getResolutionPreset(), "Preset mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 gemini-3-pro-image-preview 2:3 所有分辨率.
     */
    public function testGoogleGemini3ProAll2To3Sizes()
    {
        $sizes = [
            ['size' => '2:3', 'width' => '848', 'height' => '1264', 'ratio' => '2:3', 'preset' => '1K'],
            ['size' => '848x1264', 'width' => '848', 'height' => '1264', 'ratio' => '2:3', 'preset' => '1K'],
            ['size' => '1696x2528', 'width' => '1696', 'height' => '2528', 'ratio' => '2:3', 'preset' => '2K'],
            ['size' => '3392x5056', 'width' => '3392', 'height' => '5056', 'ratio' => '2:3', 'preset' => '4K'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::GoogleGemini,
                'gemini-3-pro-image-preview',
                null,
                $data
            );

            $this->assertInstanceOf(GoogleGeminiRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['ratio'], $request->getRatio(), "Ratio mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['preset'], $request->getResolutionPreset(), "Preset mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 gemini-3-pro-image-preview 3:2 所有分辨率.
     */
    public function testGoogleGemini3ProAll3To2Sizes()
    {
        $sizes = [
            ['size' => '3:2', 'width' => '1264', 'height' => '848', 'ratio' => '3:2', 'preset' => '1K'],
            ['size' => '1264x848', 'width' => '1264', 'height' => '848', 'ratio' => '3:2', 'preset' => '1K'],
            ['size' => '2528x1696', 'width' => '2528', 'height' => '1696', 'ratio' => '3:2', 'preset' => '2K'],
            ['size' => '5056x3392', 'width' => '5056', 'height' => '3392', 'ratio' => '3:2', 'preset' => '4K'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::GoogleGemini,
                'gemini-3-pro-image-preview',
                null,
                $data
            );

            $this->assertInstanceOf(GoogleGeminiRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['ratio'], $request->getRatio(), "Ratio mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['preset'], $request->getResolutionPreset(), "Preset mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 gemini-3-pro-image-preview 3:4 所有分辨率.
     */
    public function testGoogleGemini3ProAll3To4Sizes()
    {
        $sizes = [
            ['size' => '3:4', 'width' => '896', 'height' => '1200', 'ratio' => '3:4', 'preset' => '1K'],
            ['size' => '896x1200', 'width' => '896', 'height' => '1200', 'ratio' => '3:4', 'preset' => '1K'],
            ['size' => '1792x2400', 'width' => '1792', 'height' => '2400', 'ratio' => '3:4', 'preset' => '2K'],
            ['size' => '3584x4800', 'width' => '3584', 'height' => '4800', 'ratio' => '3:4', 'preset' => '4K'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::GoogleGemini,
                'gemini-3-pro-image-preview',
                null,
                $data
            );

            $this->assertInstanceOf(GoogleGeminiRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['ratio'], $request->getRatio(), "Ratio mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['preset'], $request->getResolutionPreset(), "Preset mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 gemini-3-pro-image-preview 4:3 所有分辨率.
     */
    public function testGoogleGemini3ProAll4To3Sizes()
    {
        $sizes = [
            ['size' => '4:3', 'width' => '1200', 'height' => '896', 'ratio' => '4:3', 'preset' => '1K'],
            ['size' => '1200x896', 'width' => '1200', 'height' => '896', 'ratio' => '4:3', 'preset' => '1K'],
            ['size' => '2400x1792', 'width' => '2400', 'height' => '1792', 'ratio' => '4:3', 'preset' => '2K'],
            ['size' => '4800x3584', 'width' => '4800', 'height' => '3584', 'ratio' => '4:3', 'preset' => '4K'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::GoogleGemini,
                'gemini-3-pro-image-preview',
                null,
                $data
            );

            $this->assertInstanceOf(GoogleGeminiRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['ratio'], $request->getRatio(), "Ratio mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['preset'], $request->getResolutionPreset(), "Preset mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 gemini-3-pro-image-preview 4:5 所有分辨率.
     */
    public function testGoogleGemini3ProAll4To5Sizes()
    {
        $sizes = [
            ['size' => '4:5', 'width' => '928', 'height' => '1152', 'ratio' => '4:5', 'preset' => '1K'],
            ['size' => '928x1152', 'width' => '928', 'height' => '1152', 'ratio' => '4:5', 'preset' => '1K'],
            ['size' => '1856x2304', 'width' => '1856', 'height' => '2304', 'ratio' => '4:5', 'preset' => '2K'],
            ['size' => '3712x4608', 'width' => '3712', 'height' => '4608', 'ratio' => '4:5', 'preset' => '4K'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::GoogleGemini,
                'gemini-3-pro-image-preview',
                null,
                $data
            );

            $this->assertInstanceOf(GoogleGeminiRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['ratio'], $request->getRatio(), "Ratio mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['preset'], $request->getResolutionPreset(), "Preset mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 gemini-3-pro-image-preview 5:4 所有分辨率.
     */
    public function testGoogleGemini3ProAll5To4Sizes()
    {
        $sizes = [
            ['size' => '5:4', 'width' => '1152', 'height' => '928', 'ratio' => '5:4', 'preset' => '1K'],
            ['size' => '1152x928', 'width' => '1152', 'height' => '928', 'ratio' => '5:4', 'preset' => '1K'],
            ['size' => '2304x1856', 'width' => '2304', 'height' => '1856', 'ratio' => '5:4', 'preset' => '2K'],
            ['size' => '4608x3712', 'width' => '4608', 'height' => '3712', 'ratio' => '5:4', 'preset' => '4K'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::GoogleGemini,
                'gemini-3-pro-image-preview',
                null,
                $data
            );

            $this->assertInstanceOf(GoogleGeminiRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['ratio'], $request->getRatio(), "Ratio mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['preset'], $request->getResolutionPreset(), "Preset mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 gemini-3-pro-image-preview 9:16 所有分辨率.
     */
    public function testGoogleGemini3ProAll9To16Sizes()
    {
        $sizes = [
            ['size' => '9:16', 'width' => '768', 'height' => '1376', 'ratio' => '9:16', 'preset' => '1K'],
            ['size' => '768x1376', 'width' => '768', 'height' => '1376', 'ratio' => '9:16', 'preset' => '1K'],
            ['size' => '1536x2752', 'width' => '1536', 'height' => '2752', 'ratio' => '9:16', 'preset' => '2K'],
            ['size' => '3072x5504', 'width' => '3072', 'height' => '5504', 'ratio' => '9:16', 'preset' => '4K'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::GoogleGemini,
                'gemini-3-pro-image-preview',
                null,
                $data
            );

            $this->assertInstanceOf(GoogleGeminiRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['ratio'], $request->getRatio(), "Ratio mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['preset'], $request->getResolutionPreset(), "Preset mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 gemini-3-pro-image-preview 16:9 所有分辨率.
     */
    public function testGoogleGemini3ProAll16To9Sizes()
    {
        $sizes = [
            ['size' => '16:9', 'width' => '1376', 'height' => '768', 'ratio' => '16:9', 'preset' => '1K'],
            ['size' => '1376x768', 'width' => '1376', 'height' => '768', 'ratio' => '16:9', 'preset' => '1K'],
            ['size' => '2752x1536', 'width' => '2752', 'height' => '1536', 'ratio' => '16:9', 'preset' => '2K'],
            ['size' => '5504x3072', 'width' => '5504', 'height' => '3072', 'ratio' => '16:9', 'preset' => '4K'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::GoogleGemini,
                'gemini-3-pro-image-preview',
                null,
                $data
            );

            $this->assertInstanceOf(GoogleGeminiRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['ratio'], $request->getRatio(), "Ratio mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['preset'], $request->getResolutionPreset(), "Preset mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 gemini-3-pro-image-preview 21:9 所有分辨率.
     */
    public function testGoogleGemini3ProAll21To9Sizes()
    {
        $sizes = [
            ['size' => '21:9', 'width' => '1584', 'height' => '672', 'ratio' => '21:9', 'preset' => '1K'],
            ['size' => '1584x672', 'width' => '1584', 'height' => '672', 'ratio' => '21:9', 'preset' => '1K'],
            ['size' => '3168x1344', 'width' => '3168', 'height' => '1344', 'ratio' => '21:9', 'preset' => '2K'],
            ['size' => '6336x2688', 'width' => '6336', 'height' => '2688', 'ratio' => '21:9', 'preset' => '4K'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::GoogleGemini,
                'gemini-3-pro-image-preview',
                null,
                $data
            );

            $this->assertInstanceOf(GoogleGeminiRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['ratio'], $request->getRatio(), "Ratio mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['preset'], $request->getResolutionPreset(), "Preset mismatch for size: {$testCase['size']}");
        }
    }

    // ==========================================================
    // Gemini 2.5 Flash Image - 所有尺寸测试
    // ==========================================================

    /**
     * 测试 gemini-2.5-flash-image 所有尺寸.
     */
    public function testGoogleGemini25FlashAllSizes()
    {
        $sizes = [
            ['size' => '1:1', 'width' => '1024', 'height' => '1024', 'ratio' => '1:1'],
            ['size' => '2:3', 'width' => '1024', 'height' => '1536', 'ratio' => '2:3'],
            ['size' => '3:2', 'width' => '1536', 'height' => '1024', 'ratio' => '3:2'],
            ['size' => '3:4', 'width' => '1024', 'height' => '1365', 'ratio' => '3:4'],
            ['size' => '4:3', 'width' => '1365', 'height' => '1024', 'ratio' => '4:3'],
            ['size' => '4:5', 'width' => '1024', 'height' => '1280', 'ratio' => '4:5'],
            ['size' => '5:4', 'width' => '1280', 'height' => '1024', 'ratio' => '5:4'],
            ['size' => '9:16', 'width' => '1024', 'height' => '1820', 'ratio' => '9:16'],
            ['size' => '16:9', 'width' => '1820', 'height' => '1024', 'ratio' => '16:9'],
            ['size' => '21:9', 'width' => '2389', 'height' => '1024', 'ratio' => '21:9'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::GoogleGemini,
                'gemini-2.5-flash-image',
                null,
                $data
            );

            $this->assertInstanceOf(GoogleGeminiRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['ratio'], $request->getRatio(), "Ratio mismatch for size: {$testCase['size']}");
            // gemini-2.5-flash-image 不支持 resolution preset
            $this->assertNull($request->getResolutionPreset(), "Preset should be null for size: {$testCase['size']}");
        }
    }

    // ==========================================================
    // Seedream 4.0 - 所有尺寸测试
    // ==========================================================

    /**
     * 测试 seedream-4-0 所有尺寸.
     */
    public function testSeedream40AllSizes()
    {
        $sizes = [
            ['size' => '1:1', 'width' => '2048', 'height' => '2048'],
            ['size' => '2:3', 'width' => '1664', 'height' => '2496'],
            ['size' => '3:2', 'width' => '2496', 'height' => '1664'],
            ['size' => '3:4', 'width' => '1728', 'height' => '2304'],
            ['size' => '4:3', 'width' => '2304', 'height' => '1728'],
            ['size' => '9:16', 'width' => '1440', 'height' => '2560'],
            ['size' => '16:9', 'width' => '2560', 'height' => '1440'],
            ['size' => '21:9', 'width' => '2048', 'height' => '2048'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::VolcengineArk,
                'unknown-version',
                'seedream-4-0',
                $data
            );

            $this->assertInstanceOf(VolcengineArkRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
        }
    }

    // ==========================================================
    // Seedream 4.5 - 所有尺寸测试
    // ==========================================================

    /**
     * 测试 seedream-4-5 1:1 所有放大倍数.
     */
    public function testSeedream45All1To1Sizes()
    {
        $sizes = [
            ['size' => '1:1', 'width' => '2048', 'height' => '2048'],
            ['size' => '2048x2048', 'width' => '2048', 'height' => '2048'],
            ['size' => '4096x4096', 'width' => '4096', 'height' => '4096'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::VolcengineArk,
                'unknown-version',
                'seedream-4-5',
                $data
            );

            $this->assertInstanceOf(VolcengineArkRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 seedream-4-5 2:3 所有放大倍数.
     */
    public function testSeedream45All2To3Sizes()
    {
        $sizes = [
            ['size' => '2:3', 'width' => '1664', 'height' => '2496'],
            ['size' => '1664x2496', 'width' => '1664', 'height' => '2496'],
            ['size' => '2731x4096', 'width' => '2731', 'height' => '4096'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::VolcengineArk,
                'unknown-version',
                'seedream-4-5',
                $data
            );

            $this->assertInstanceOf(VolcengineArkRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 seedream-4-5 3:2 所有放大倍数.
     */
    public function testSeedream45All3To2Sizes()
    {
        $sizes = [
            ['size' => '3:2', 'width' => '2496', 'height' => '1664'],
            ['size' => '2496x1664', 'width' => '2496', 'height' => '1664'],
            ['size' => '4096x2731', 'width' => '4096', 'height' => '2731'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::VolcengineArk,
                'unknown-version',
                'seedream-4-5',
                $data
            );

            $this->assertInstanceOf(VolcengineArkRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 seedream-4-5 3:4 所有放大倍数.
     */
    public function testSeedream45All3To4Sizes()
    {
        $sizes = [
            ['size' => '3:4', 'width' => '1728', 'height' => '2304'],
            ['size' => '1728x2304', 'width' => '1728', 'height' => '2304'],
            ['size' => '3072x4096', 'width' => '3072', 'height' => '4096'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::VolcengineArk,
                'unknown-version',
                'seedream-4-5',
                $data
            );

            $this->assertInstanceOf(VolcengineArkRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 seedream-4-5 4:3 所有放大倍数.
     */
    public function testSeedream45All4To3Sizes()
    {
        $sizes = [
            ['size' => '4:3', 'width' => '2304', 'height' => '1728'],
            ['size' => '2304x1728', 'width' => '2304', 'height' => '1728'],
            ['size' => '4096x3072', 'width' => '4096', 'height' => '3072'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::VolcengineArk,
                'unknown-version',
                'seedream-4-5',
                $data
            );

            $this->assertInstanceOf(VolcengineArkRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 seedream-4-5 9:16 所有放大倍数.
     */
    public function testSeedream45All9To16Sizes()
    {
        $sizes = [
            ['size' => '9:16', 'width' => '1440', 'height' => '2560'],
            ['size' => '1440x2560', 'width' => '1440', 'height' => '2560'],
            ['size' => '2304x4096', 'width' => '2304', 'height' => '4096'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::VolcengineArk,
                'unknown-version',
                'seedream-4-5',
                $data
            );

            $this->assertInstanceOf(VolcengineArkRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 seedream-4-5 16:9 所有放大倍数.
     */
    public function testSeedream45All16To9Sizes()
    {
        $sizes = [
            ['size' => '16:9', 'width' => '2560', 'height' => '1440'],
            ['size' => '2560x1440', 'width' => '2560', 'height' => '1440'],
            ['size' => '4096x2304', 'width' => '4096', 'height' => '2304'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::VolcengineArk,
                'unknown-version',
                'seedream-4-5',
                $data
            );

            $this->assertInstanceOf(VolcengineArkRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
        }
    }

    /**
     * 测试 seedream-4-5 21:9 所有放大倍数.
     */
    public function testSeedream45All21To9Sizes()
    {
        $sizes = [
            ['size' => '21:9', 'width' => '2048', 'height' => '2048'],
            ['size' => '2048x2048', 'width' => '2048', 'height' => '2048'],
            ['size' => '4096x1755', 'width' => '4096', 'height' => '1755'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::VolcengineArk,
                'unknown-version',
                'seedream-4-5',
                $data
            );

            $this->assertInstanceOf(VolcengineArkRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
        }
    }

    // ==========================================================
    // Qwen Image - 所有尺寸测试
    // ==========================================================

    /**
     * 测试 qwen-image 所有尺寸.
     */
    public function testQwenImageAllSizes()
    {
        $sizes = [
            ['size' => '1:1', 'width' => '1328', 'height' => '1328'],
            ['size' => '3:4', 'width' => '1104', 'height' => '1472'],
            ['size' => '4:3', 'width' => '1472', 'height' => '1104'],
            ['size' => '9:16', 'width' => '928', 'height' => '1664'],
            ['size' => '16:9', 'width' => '1664', 'height' => '928'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::QwenImage,
                'qwen-image',
                null,
                $data
            );

            $this->assertInstanceOf(QwenImageModelRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
        }
    }

    // ==========================================================
    // Azure OpenAI Image Generate - 所有尺寸测试
    // ==========================================================

    /**
     * 测试 AzureOpenAI-ImageGenerate 所有尺寸.
     */
    public function testAzureOpenAIImageGenerateAllSizes()
    {
        $sizes = [
            ['size' => '1:1', 'width' => '1024', 'height' => '1024', 'sizeStr' => '1024x1024'],
            ['size' => '2:3', 'width' => '1024', 'height' => '1536', 'sizeStr' => '1024x1536'],
            ['size' => '3:2', 'width' => '1536', 'height' => '1024', 'sizeStr' => '1536x1024'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];

            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::AzureOpenAIImageGenerate,
                'AzureOpenAI-ImageGenerate',
                null,
                $data
            );

            $this->assertInstanceOf(AzureOpenAIImageRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['sizeStr'], $request->getSize(), "Size string mismatch for size: {$testCase['size']}");
        }
    }

    // ==========================================================
    // Azure OpenAI Image Edit - 所有尺寸测试
    // ==========================================================

    /**
     * 测试 AzureOpenAI-ImageEdit 所有尺寸.
     */
    public function testAzureOpenAIImageEditAllSizes()
    {
        $sizes = [
            ['size' => '1:1', 'width' => '1024', 'height' => '1024', 'sizeStr' => '1024x1024'],
            ['size' => '2:3', 'width' => '1024', 'height' => '1536', 'sizeStr' => '1024x1536'],
            ['size' => '3:2', 'width' => '1536', 'height' => '1024', 'sizeStr' => '1536x1024'],
        ];

        foreach ($sizes as $testCase) {
            $data = $this->getCommonData();
            $data['size'] = $testCase['size'];
            $request = ImageGenerateFactory::createRequestType(
                ImageGenerateModelType::AzureOpenAIImageEdit,
                'AzureOpenAI-ImageEdit',
                null,
                $data
            );

            $this->assertInstanceOf(AzureOpenAIImageRequest::class, $request, "Failed for size: {$testCase['size']}");
            $this->assertEquals($testCase['width'], $request->getWidth(), "Width mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['height'], $request->getHeight(), "Height mismatch for size: {$testCase['size']}");
            $this->assertEquals($testCase['sizeStr'], $request->getSize(), "Size string mismatch for size: {$testCase['size']}");
        }
    }

    private function getCommonData(): array
    {
        return [
            'user_prompt' => 'test prompt',
            'negative_prompt' => '',
            'generate_num' => 1,
            'use_sr' => false,
            'reference_images' => [],
            'model' => 'test-model',
            'organization_code' => 'org-code',
        ];
    }
}
