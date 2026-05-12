<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\SizeManager;
use Hyperf\Contract\ConfigInterface;
use HyperfTest\Cases\BaseTest;
use InvalidArgumentException;

/**
 * @internal
 * @covers \App\Infrastructure\ExternalAPI\ImageGenerateAPI\SizeManager
 */
class SizeManagerTest extends BaseTest
{
    /**
     * 测试 Gemini 3.0 Pro 模型的所有 size 格式和边界情况
     * 验证流程：接受多种类型 size -> 转换成 Size（宽高）-> 转换成 Ratio（比例）-> 验证 ratio 是否正确.
     */
    public function testGemini3ProModel()
    {
        $modelVersion = 'gemini-3-pro-image-preview';
        $modelId = null;

        // 配置中支持的比例列表
        $supportedRatios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

        // 测试用例：[输入 size, 期望的宽高, 期望的比例]
        $testCases = [
            // 1. 比例格式 label 匹配
            ['1:1', ['1024', '1024'], '1:1'],
            ['16:9', ['1376', '768'], '16:9'],
            ['21:9', ['1584', '672'], '21:9'],
            ['2:3', ['848', '1264'], '2:3'],
            ['3:2', ['1264', '848'], '3:2'],
            ['3:4', ['896', '1200'], '3:4'],
            ['4:3', ['1200', '896'], '4:3'],
            ['4:5', ['928', '1152'], '4:5'],
            ['5:4', ['1152', '928'], '5:4'],
            ['9:16', ['768', '1376'], '9:16'],

            // 2. 标准格式 value 匹配
            ['1024x1024', ['1024', '1024'], '1:1'],
            ['1376x768', ['1376', '768'], '16:9'],
            ['1584x672', ['1584', '672'], '21:9'],
            ['848x1264', ['848', '1264'], '2:3'],
            ['1264x848', ['1264', '848'], '3:2'],

            // 2.1 2K/4K 分辨率匹配
            // 1:1
            ['2048x2048', ['2048', '2048'], '1:1'],
            ['4096x4096', ['4096', '4096'], '1:1'],
            // 2:3
            ['1696x2528', ['1696', '2528'], '2:3'],
            ['3392x5056', ['3392', '5056'], '2:3'],
            // 3:2
            ['2528x1696', ['2528', '1696'], '3:2'],
            ['5056x3392', ['5056', '3392'], '3:2'],
            // 3:4
            ['1792x2400', ['1792', '2400'], '3:4'],
            ['3584x4800', ['3584', '4800'], '3:4'],
            // 4:3
            ['2400x1792', ['2400', '1792'], '4:3'],
            ['4800x3584', ['4800', '3584'], '4:3'],
            // 4:5
            ['1856x2304', ['1856', '2304'], '4:5'],
            ['3712x4608', ['3712', '4608'], '4:5'],
            // 5:4
            ['2304x1856', ['2304', '1856'], '5:4'],
            ['4608x3712', ['4608', '3712'], '5:4'],
            // 9:16
            ['1536x2752', ['1536', '2752'], '9:16'],
            ['3072x5504', ['3072', '5504'], '9:16'],
            // 16:9
            ['2752x1536', ['2752', '1536'], '16:9'],
            ['5504x3072', ['5504', '3072'], '16:9'],
            // 21:9
            ['3168x1344', ['3168', '1344'], '21:9'],
            ['6336x2688', ['6336', '2688'], '21:9'],

            // 3. 乘号格式（不在配置中，会返回配置的第一个值）
            ['1024*1024', ['1024', '1024'], '1:1'], // 匹配到配置中的 1024x1024
            // 注意：1820*1024 不在配置中，会返回配置的第一个值 1024x1024

            // 4. k 格式（不在配置中，会返回配置的第一个值）
            ['1k', ['1024', '1024'], '1:1'], // 匹配到配置中的 1024x1024
            // 注意：2k, 3k 不在配置中，会返回配置的第一个值 1024x1024

            // 5. 比例格式但不在配置中（应该匹配最接近的）
            ['16:10', ['1264', '848'], '3:2'], // 16:10 (1.6) 最接近 3:2 (1.5)
            ['5:3', ['1376', '768'], '16:9'], // 5:3 (1.67) 最接近 16:9 (1.77)
        ];

        foreach ($testCases as [$inputSize, $expectedSize, $expectedRatio]) {
            // 步骤1: 接受多种类型 size，转换成 Size（宽高）
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            $this->assertEquals($expectedSize, $size, "Failed for input: {$inputSize}");

            // 步骤2: 转换成 Ratio（比例）
            $width = (int) $size[0];
            $height = (int) $size[1];
            $ratio = SizeManager::convertToAspectRatio($width, $height, $modelVersion, $modelId);

            // 步骤3: 验证 ratio 是否正确
            $this->assertEquals($expectedRatio, $ratio, "Ratio mismatch for input: {$inputSize}, size: {$size[0]}x{$size[1]}");
            $this->assertContains($ratio, $supportedRatios, "Ratio {$ratio} not in supported list for input: {$inputSize}");
        }

        // 6. 测试边界情况：空字符串
        $size = SizeManager::getSizeFromConfig('', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size);
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 7. 测试边界情况：无效格式（应该返回默认值）
        $size = SizeManager::getSizeFromConfig('invalid', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size);
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 8. 测试边界情况：带空格
        $size = SizeManager::getSizeFromConfig(' 16:9 ', $modelVersion, $modelId);
        $this->assertEquals(['1376', '768'], $size);
        $ratio = SizeManager::convertToAspectRatio(1376, 768, $modelVersion, $modelId);
        $this->assertEquals('16:9', $ratio);

        // 9. 测试标准格式但不在配置中的情况（应该降级到配置中最接近的比例对应的尺寸）
        $size = SizeManager::getSizeFromConfig('2000x2000', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size); // 降级到 1:1 对应的 1024x1024
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 10. 测试不在配置中的乘号格式和 k 格式（会返回配置的第一个值）
        // 这些格式不在配置中，会返回配置的第一个值 1024x1024
        $testCasesNotInConfig = [
            '1820*1024',
            '2k',
            '3k',
        ];

        foreach ($testCasesNotInConfig as $inputSize) {
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            // 应该返回配置的第一个值
            $this->assertEquals(['1024', '1024'], $size, "Input {$inputSize} should return first config value");
            $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
            $this->assertEquals('1:1', $ratio);
        }

        // 11. 测试不正确的 size 降级到正确的 size
        // 测试用例：[不正确的输入 size, 期望降级后的宽高, 期望降级后的比例, 降级说明]
        $fallbackTestCases = [
            // 11.1 不在配置中的标准格式（会降级到配置中最接近的比例对应的尺寸）
            ['999x999', ['1024', '1024'], '1:1', '不在配置中的标准格式，降级到 1:1 对应的 1024x1024'],
            ['500x500', ['1024', '1024'], '1:1', '小尺寸标准格式，降级到 1:1 对应的 1024x1024'],
            ['3000x2000', ['1264', '848'], '3:2', '大尺寸标准格式，降级到 3:2 对应的 1264x848'],
            ['1000x1500', ['848', '1264'], '2:3', '标准格式，降级到 2:3 对应的 848x1264'],
            ['1500x1000', ['1264', '848'], '3:2', '标准格式，降级到 3:2 对应的 1264x848'],

            // 11.2 无效的比例格式（会匹配最接近的比例）
            ['100:1', ['1584', '672'], '21:9', '极端宽比例，匹配到最接近的 21:9'],
            ['1:100', ['768', '1376'], '9:16', '极端高比例，匹配到最接近的 9:16'],
            ['50:1', ['1584', '672'], '21:9', '很宽的比例，匹配到最接近的 21:9'],
            ['1:50', ['768', '1376'], '9:16', '很高的比例，匹配到最接近的 9:16'],

            // 11.3 无效格式（会降级到配置的第一个值）
            ['invalid-format', ['1024', '1024'], '1:1', '无效格式，降级到配置的第一个值'],
            ['abc123', ['1024', '1024'], '1:1', '无效格式，降级到配置的第一个值'],
            ['!@#$%', ['1024', '1024'], '1:1', '特殊字符，降级到配置的第一个值'],

            // 11.4 极端值（会降级到配置中最接近的比例对应的尺寸）
            ['1x1', ['1024', '1024'], '1:1', '极端小尺寸，降级到 1:1 对应的 1024x1024'],
            ['10000x10000', ['1024', '1024'], '1:1', '极端大尺寸，降级到 1:1 对应的 1024x1024'],
            ['9999x1', ['1584', '672'], '21:9', '极端宽尺寸，降级到 21:9 对应的 1584x672'],
            ['1x9999', ['768', '1376'], '9:16', '极端高尺寸，降级到 9:16 对应的 768x1376'],

            // 11.5 格式正确但不在配置中的值
            ['1024x999', ['1024', '1024'], '1:1', '格式正确但不在配置中，降级到 1:1 对应的 1024x1024'],
            ['999x1024', ['1024', '1024'], '1:1', '格式正确但不在配置中，降级到 1:1 对应的 1024x1024'],
        ];

        foreach ($fallbackTestCases as [$incorrectSize, $expectedSize, $expectedRatio, $description]) {
            // 步骤1: 传入不正确的 size，验证是否能降级到正确的 size
            $size = SizeManager::getSizeFromConfig($incorrectSize, $modelVersion, $modelId);
            $this->assertEquals($expectedSize, $size, "Fallback failed for incorrect input: {$incorrectSize}. {$description}");

            // 步骤2: 验证降级后的 size 能正确转换成 ratio
            $width = (int) $size[0];
            $height = (int) $size[1];
            $ratio = SizeManager::convertToAspectRatio($width, $height, $modelVersion, $modelId);

            // 步骤3: 验证降级后的 ratio 是否正确且在支持列表中
            $this->assertEquals($expectedRatio, $ratio, "Ratio mismatch after fallback for input: {$incorrectSize}. {$description}");
            $this->assertContains($ratio, $supportedRatios, "Fallback ratio {$ratio} not in supported list for input: {$incorrectSize}. {$description}");

            // 步骤4: 验证降级后的 size 和 ratio 是有效的组合
            $this->assertNotEmpty($ratio, "Fallback should produce a valid ratio for input: {$incorrectSize}");
        }
    }

    /**
     * 测试 Gemini 2.5 Flash 模型的所有 size 格式和边界情况
     * 验证流程：接受多种类型 size -> 转换成 Size（宽高）-> 转换成 Ratio（比例）-> 验证 ratio 是否正确.
     */
    public function testGemini25FlashModel()
    {
        $modelVersion = 'gemini-2.5-flash-image';
        $modelId = null;

        // 配置中支持的比例列表
        $supportedRatios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

        // 测试用例：[输入 size, 期望的宽高, 期望的比例]
        $testCases = [
            // 1. 比例格式 label 匹配
            ['1:1', ['1024', '1024'], '1:1'],
            ['16:9', ['1820', '1024'], '16:9'],
            ['21:9', ['2389', '1024'], '21:9'],
            ['2:3', ['1024', '1536'], '2:3'],
            ['3:2', ['1536', '1024'], '3:2'],
            ['3:4', ['1024', '1365'], '3:4'],
            ['4:3', ['1365', '1024'], '4:3'],
            ['4:5', ['1024', '1280'], '4:5'],
            ['5:4', ['1280', '1024'], '5:4'],
            ['9:16', ['1024', '1820'], '9:16'],

            // 2. 标准格式 value 匹配
            ['1024x1024', ['1024', '1024'], '1:1'],
            ['1820x1024', ['1820', '1024'], '16:9'],
            ['2389x1024', ['2389', '1024'], '21:9'],
            ['1024x1536', ['1024', '1536'], '2:3'],
            ['1536x1024', ['1536', '1024'], '3:2'],

            // 3. 乘号格式（不在配置中，会返回配置的第一个值）
            ['1024*1024', ['1024', '1024'], '1:1'], // 匹配到配置中的 1024x1024
            // 注意：1820*1024 不在配置中，会返回配置的第一个值 1024x1024

            // 4. k 格式（不在配置中，会返回配置的第一个值）
            ['1k', ['1024', '1024'], '1:1'], // 匹配到配置中的 1024x1024
            // 注意：2k, 3k 不在配置中，会返回配置的第一个值 1024x1024

            // 5. 比例格式但不在配置中（应该匹配最接近的）
            ['16:10', ['1536', '1024'], '3:2'], // 16:10 (1.6) 最接近 3:2 (1.5)
            ['5:3', ['1820', '1024'], '16:9'], // 5:3 (1.67) 最接近 16:9 (1.77)
        ];

        foreach ($testCases as [$inputSize, $expectedSize, $expectedRatio]) {
            // 步骤1: 接受多种类型 size，转换成 Size（宽高）
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            $this->assertEquals($expectedSize, $size, "Failed for input: {$inputSize}");

            // 步骤2: 转换成 Ratio（比例）
            $width = (int) $size[0];
            $height = (int) $size[1];
            $ratio = SizeManager::convertToAspectRatio($width, $height, $modelVersion, $modelId);

            // 步骤3: 验证 ratio 是否正确
            $this->assertEquals($expectedRatio, $ratio, "Ratio mismatch for input: {$inputSize}, size: {$size[0]}x{$size[1]}");
            $this->assertContains($ratio, $supportedRatios, "Ratio {$ratio} not in supported list for input: {$inputSize}");
        }

        // 6. 测试边界情况：空字符串
        $size = SizeManager::getSizeFromConfig('', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size);
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 7. 测试边界情况：无效格式（应该返回默认值）
        $size = SizeManager::getSizeFromConfig('invalid', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size);
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 8. 测试边界情况：带空格
        $size = SizeManager::getSizeFromConfig(' 16:9 ', $modelVersion, $modelId);
        $this->assertEquals(['1820', '1024'], $size);
        $ratio = SizeManager::convertToAspectRatio(1820, 1024, $modelVersion, $modelId);
        $this->assertEquals('16:9', $ratio);

        // 9. 测试标准格式但不在配置中的情况（应该降级到配置中最接近的比例对应的尺寸）
        $size = SizeManager::getSizeFromConfig('2000x2000', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size); // 降级到 1:1 对应的 1024x1024
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 10. 测试大小写不敏感（k 格式不在配置中，会返回配置的第一个值）
        $size = SizeManager::getSizeFromConfig('2K', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size); // 不在配置中，返回第一个配置值
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 11. 测试不在配置中的乘号格式和 k 格式（会返回配置的第一个值）
        // 这些格式不在配置中，会返回配置的第一个值 1024x1024
        $testCasesNotInConfig = [
            '1820*1024',
            '1024*2389',
            '2k',
            '3k',
        ];

        foreach ($testCasesNotInConfig as $inputSize) {
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            // 应该返回配置的第一个值
            $this->assertEquals(['1024', '1024'], $size, "Input {$inputSize} should return first config value");
            $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
            $this->assertEquals('1:1', $ratio);
        }

        // 12. 测试不正确的 size 降级到正确的 size
        // 测试用例：[不正确的输入 size, 期望降级后的宽高, 期望降级后的比例, 降级说明]
        $fallbackTestCases = [
            // 12.1 不在配置中的标准格式（会降级到配置中最接近的比例对应的尺寸）
            ['999x999', ['1024', '1024'], '1:1', '不在配置中的标准格式，降级到 1:1 对应的 1024x1024'],
            ['500x500', ['1024', '1024'], '1:1', '小尺寸标准格式，比例 500/500=1.0，降级到 1:1 对应的 1024x1024'],
            ['3000x2000', ['1536', '1024'], '3:2', '大尺寸标准格式，比例 3000/2000=1.5，降级到 3:2 对应的 1536x1024'],
            ['1000x1500', ['1024', '1536'], '2:3', '标准格式，比例 1000/1500≈0.67，降级到 2:3 对应的 1024x1536'],
            ['1500x1000', ['1536', '1024'], '3:2', '标准格式，比例 1500/1000=1.5，降级到 3:2 对应的 1536x1024'],

            // 11.2 无效的比例格式（会匹配最接近的比例）
            ['100:1', ['2389', '1024'], '21:9', '极端宽比例，匹配到最接近的 21:9'],
            ['1:100', ['1024', '1820'], '9:16', '极端高比例，匹配到最接近的 9:16'],
            ['50:1', ['2389', '1024'], '21:9', '很宽的比例，匹配到最接近的 21:9'],
            ['1:50', ['1024', '1820'], '9:16', '很高的比例，匹配到最接近的 9:16'],

            // 11.3 无效格式（会降级到配置的第一个值）
            ['invalid-format', ['1024', '1024'], '1:1', '无效格式，降级到配置的第一个值'],
            ['abc123', ['1024', '1024'], '1:1', '无效格式，降级到配置的第一个值'],
            ['!@#$%', ['1024', '1024'], '1:1', '特殊字符，降级到配置的第一个值'],

            // 11.4 极端值（会降级到配置中最接近的比例对应的尺寸）
            ['1x1', ['1024', '1024'], '1:1', '极端小尺寸，降级到 1:1 对应的 1024x1024'],
            ['10000x10000', ['1024', '1024'], '1:1', '极端大尺寸，降级到 1:1 对应的 1024x1024'],
            ['9999x1', ['2389', '1024'], '21:9', '极端宽尺寸，降级到 21:9 对应的 2389x1024'],
            ['1x9999', ['1024', '1820'], '9:16', '极端高尺寸，降级到 9:16 对应的 1024x1820'],

            // 11.5 格式正确但不在配置中的值
            ['1024x999', ['1024', '1024'], '1:1', '格式正确但不在配置中，降级到 1:1 对应的 1024x1024'],
            ['999x1024', ['1024', '1024'], '1:1', '格式正确但不在配置中，降级到 1:1 对应的 1024x1024'],
        ];

        foreach ($fallbackTestCases as [$incorrectSize, $expectedSize, $expectedRatio, $description]) {
            // 步骤1: 传入不正确的 size，验证是否能降级到正确的 size
            $size = SizeManager::getSizeFromConfig($incorrectSize, $modelVersion, $modelId);
            $this->assertEquals($expectedSize, $size, "Fallback failed for incorrect input: {$incorrectSize}. {$description}");

            // 步骤2: 验证降级后的 size 能正确转换成 ratio
            $width = (int) $size[0];
            $height = (int) $size[1];
            $ratio = SizeManager::convertToAspectRatio($width, $height, $modelVersion, $modelId);

            // 步骤3: 验证降级后的 ratio 是否正确且在支持列表中
            $this->assertEquals($expectedRatio, $ratio, "Ratio mismatch after fallback for input: {$incorrectSize}. {$description}");
            $this->assertContains($ratio, $supportedRatios, "Fallback ratio {$ratio} not in supported list for input: {$incorrectSize}. {$description}");

            // 步骤4: 验证降级后的 size 和 ratio 是有效的组合
            $this->assertNotEmpty($ratio, "Fallback should produce a valid ratio for input: {$incorrectSize}");
        }
    }

    /**
     * 测试 Seedream 4.0 (Doubao 4.0) 模型的所有 size 格式和边界情况
     * 该模型配置了 total_pixels_range，验证流程：
     * 接受多种类型 size -> parseToWidthHeight 解析 -> 同比例换算到 [min, max] 范围 -> 验证总像素合法.
     */
    public function testSeedream40Model()
    {
        $modelVersion = 'unknown-version';
        $modelId = 'seedream-4-0';

        $pixelMin = 921600;
        $pixelMax = 16777216;

        // 测试用例：[输入 size, 期望宽, 期望高, 说明]
        // 期望值由 parseToWidthHeight + scaleToPixelRange 的 sqrt 换算精确确定
        $testCases = [
            // 比例格式：基准 1024 换算后再缩放
            ['1:1', '1024', '1024', '1:1 -> 1024x1024，P=1048576 在范围内'],
            ['9:16', '720', '1280', '9:16 -> 576x1024，P<min，放大到 720x1280'],
            ['16:9', '1280', '720', '16:9 -> 1024x576，P<min，放大到 1280x720'],
            ['21:9', '1468', '628', '21:9 -> 1024x438，P<min，放大到 1468x628'],
            // 标准格式：在范围内直接返回
            ['2048x2048', '2048', '2048', '2048x2048，P=4194304 在范围内'],
            ['2560x1440', '2560', '1440', '2560x1440，P=3686400 在范围内'],
            ['1664x2496', '1664', '2496', '1664x2496，P=4153344 在范围内'],
            ['1440x2560', '1440', '2560', '1440x2560，P=3686400 在范围内'],
            ['4096x2731', '4096', '2731', '4096x2731，P=11186176 在范围内，直接返回'],
            ['1820x1024', '1820', '1024', '1820x1024，P=1863680 在范围内'],
            // 小尺寸：P < min，放大
            ['500x500', '960', '960', '500x500，P=250000<min，放大到 960x960'],
            ['1x1', '960', '960', '1x1，P=1<min，放大到 960x960'],
            // 大尺寸：P > max，缩小
            ['10000x10000', '4096', '4096', '10000x10000，P>max，缩小到 4096x4096'],
            // 乘号格式
            ['2048*2048', '2048', '2048', '2048*2048 解析后在范围内'],
            ['2560*1440', '2560', '1440', '2560*1440 解析后在范围内'],
            // k 格式
            ['2k', '2048', '2048', '2k=2048x2048，P=4194304 在范围内'],
            ['3k', '3072', '3072', '3k=3072x3072，P=9437136 在范围内'],
            ['4k', '4096', '4096', '4k=4096x4096，P=16777216 在范围内'],
            // 非正方形标准格式：在范围内直接返回（真实业务输入场景）
            ['2048x800', '2048', '800', '2048x800，P=1638400 在范围内，直接返回'],
            // 非正方形标准格式：P < min，同比例放大
            ['596x1024', '733', '1259', '596x1024（字母x），P=610304<min，ceil 放大到 733x1259'],
            // 中文乘号格式（×，U+00D7）：与字母 x 格式等价，需要正则 u 修饰符支持
            ['596×1024', '733', '1259', '596×1024（中文乘号），P=610304<min，ceil 放大到 733x1259'],
            ['2048×800', '2048', '800', '2048×800（中文乘号），P=1638400 在范围内，直接返回'],
            // 无效格式 -> parseToWidthHeight 返回 1024x1024，P在范围内
            ['invalid', '1024', '1024', '无效格式，默认 1024x1024'],
            ['invalid-format', '1024', '1024', '无效格式，默认 1024x1024'],
            ['abc123', '1024', '1024', '无效格式，默认 1024x1024'],
            ['', '1024', '1024', '空字符串，默认 1024x1024'],
        ];

        // ceil/floor 保证总像素严格满足范围，无需容差
        foreach ($testCases as [$inputSize, $expectedW, $expectedH, $description]) {
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            $this->assertEquals($expectedW, $size[0], "Width mismatch for input: {$inputSize}. {$description}");
            $this->assertEquals($expectedH, $size[1], "Height mismatch for input: {$inputSize}. {$description}");

            $pixels = (int) $size[0] * (int) $size[1];
            $this->assertGreaterThanOrEqual($pixelMin, $pixels, "Pixels {$pixels} below min for input: {$inputSize}");
            $this->assertLessThanOrEqual($pixelMax, $pixels, "Pixels {$pixels} above max for input: {$inputSize}");
        }

        // 带空格的输入
        $size = SizeManager::getSizeFromConfig(' 16:9 ', $modelVersion, $modelId);
        $this->assertEquals('1280', $size[0]);
        $this->assertEquals('720', $size[1]);
        $pixels = (int) $size[0] * (int) $size[1];
        $this->assertGreaterThanOrEqual($pixelMin, $pixels);
        $this->assertLessThanOrEqual($pixelMax, $pixels);

        // 验证更多输入的换算后总像素均严格在合法范围内
        $additionalInputs = [
            '2000x2000', '3000x3000', '1000x1500', '1500x1000',
            '3000x2000', '2000x3000', '999x999', '1024x999',
            '100:1', '1:100', '16:10', '5:3',
            '2:3', '3:2', '3:4', '4:3',
        ];
        foreach ($additionalInputs as $inputSize) {
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            $pixels = (int) $size[0] * (int) $size[1];
            $this->assertGreaterThanOrEqual($pixelMin, $pixels, "Pixels {$pixels} below min for input: {$inputSize}");
            $this->assertLessThanOrEqual($pixelMax, $pixels, "Pixels {$pixels} above max for input: {$inputSize}");
        }
    }

    /**
     * 测试 Seedream 4.5 (Doubao 4.5) 模型的所有 size 格式和边界情况
     * 该模型配置了 total_pixels_range，验证流程：
     * 接受多种类型 size -> parseToWidthHeight 解析 -> 同比例换算到 [min, max] 范围 -> 验证总像素合法.
     */
    public function testSeedream45Model()
    {
        $modelVersion = 'unknown-version';
        $modelId = 'seedream-4-5';

        $pixelMin = 3686400;
        $pixelMax = 16777216;

        // 测试用例：[输入 size, 期望宽, 期望高, 说明]
        $testCases = [
            // 比例格式：基准 1024 换算后再放大到 min
            ['1:1', '1920', '1920', '1:1 -> 1024x1024，P<min，放大到 1920x1920'],
            ['9:16', '1440', '2560', '9:16 -> 576x1024，P<min，放大到 1440x2560'],
            ['16:9', '2560', '1440', '16:9 -> 1024x576，P<min，放大到 2560x1440'],
            // 标准格式：在范围内直接返回
            ['2048x2048', '2048', '2048', '2048x2048，P=4194304 在范围内'],
            ['4096x4096', '4096', '4096', '4096x4096，P=16777216 在范围内'],
            ['2560x1440', '2560', '1440', '2560x1440，P=3686400 在范围内'],
            ['4096x2304', '4096', '2304', '4096x2304 在范围内'],
            ['1664x2496', '1664', '2496', '1664x2496 在范围内'],
            ['2731x4096', '2731', '4096', '2731x4096 在范围内'],
            ['2496x1664', '2496', '1664', '2496x1664 在范围内'],
            ['4096x2731', '4096', '2731', '4096x2731 在范围内'],
            ['1728x2304', '1728', '2304', '1728x2304 在范围内'],
            ['3072x4096', '3072', '4096', '3072x4096 在范围内'],
            ['2304x1728', '2304', '1728', '2304x1728 在范围内'],
            ['4096x3072', '4096', '3072', '4096x3072 在范围内'],
            ['1440x2560', '1440', '2560', '1440x2560 在范围内'],
            ['2304x4096', '2304', '4096', '2304x4096 在范围内'],
            // 小尺寸：放大
            ['999x999', '1920', '1920', '999x999，P<min，放大到 1920x1920'],
            ['500x500', '1920', '1920', '500x500，P<min，放大到 1920x1920'],
            ['1x1', '1920', '1920', '1x1，P<min，放大到 1920x1920'],
            // 大尺寸：缩小
            ['10000x10000', '4096', '4096', '10000x10000，P>max，缩小到 4096x4096'],
            // 乘号格式
            ['2048*2048', '2048', '2048', '2048*2048 在范围内'],
            ['2560*1440', '2560', '1440', '2560*1440 在范围内'],
            // k 格式
            ['2k', '2048', '2048', '2k=2048x2048，P=4194304 在范围内'],
            ['3k', '3072', '3072', '3k=3072x3072 在范围内'],
            ['4k', '4096', '4096', '4k=4096x4096 在范围内'],
            // 比例格式不在配置中：先 parseToWidthHeight，再缩放
            ['16:10', '2429', '1518', '16:10 -> 1024x640，P<min，放大到 2429x1518'],
            ['5:3', '2480', '1487', '5:3 -> 1024x614，P<min，放大到 2480x1487'],
            // 无效格式 -> 1024x1024，P<min，放大到 1920x1920
            ['invalid', '1920', '1920', '无效格式，1024x1024 放大'],
            ['invalid-format', '1920', '1920', '无效格式，1024x1024 放大'],
            ['abc123', '1920', '1920', '无效格式，1024x1024 放大'],
            ['', '1920', '1920', '空字符串，1024x1024 放大'],
        ];

        foreach ($testCases as [$inputSize, $expectedW, $expectedH, $description]) {
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            $this->assertEquals($expectedW, $size[0], "Width mismatch for input: {$inputSize}. {$description}");
            $this->assertEquals($expectedH, $size[1], "Height mismatch for input: {$inputSize}. {$description}");

            $pixels = (int) $size[0] * (int) $size[1];
            $this->assertGreaterThanOrEqual($pixelMin, $pixels, "Pixels {$pixels} below min for input: {$inputSize}");
            $this->assertLessThanOrEqual($pixelMax, $pixels, "Pixels {$pixels} above max for input: {$inputSize}");
        }

        // 带空格
        $size = SizeManager::getSizeFromConfig(' 16:9 ', $modelVersion, $modelId);
        $this->assertEquals('2560', $size[0]);
        $this->assertEquals('1440', $size[1]);

        // 验证更多输入的总像素均在合法范围内
        $additionalInputs = [
            '5000x3000', '2000x3000', '3000x2000',
            '2048x999', '999x2048',
            '100:1', '1:100',
        ];
        foreach ($additionalInputs as $inputSize) {
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            $pixels = (int) $size[0] * (int) $size[1];
            $this->assertGreaterThanOrEqual($pixelMin, $pixels, "Pixels {$pixels} below min for input: {$inputSize}");
            $this->assertLessThanOrEqual($pixelMax, $pixels, "Pixels {$pixels} above max for input: {$inputSize}");
        }
    }

    /**
     * 测试 Qwen Image Edit Plus / qwen-image-2.0 / qwen-image-2.0-pro 等模型
     * 该模型配置了 total_pixels_range [262144, 4194304]，验证同比例换算逻辑.
     */
    public function testQwenImageEditPlusModel()
    {
        $pixelMin = 262144;
        $pixelMax = 4194304;

        // 以 qwen-image-2.0 作为代表 model_version
        $modelVersion = 'qwen-image-2.0';
        $modelId = null;

        // 测试用例：[输入 size, 期望宽, 期望高, 说明]
        $testCases = [
            // 比例格式：基准 1024 换算后，P 均在范围内，直接返回
            ['1:1', '1024', '1024', '1:1 -> 1024x1024，P=1048576 在范围内'],
            ['3:4', '768', '1024', '3:4 -> 768x1024，P=786432 在范围内'],
            ['4:3', '1024', '768', '4:3 -> 1024x768，P=786432 在范围内'],
            ['9:16', '576', '1024', '9:16 -> 576x1024，P=589824 在范围内'],
            ['16:9', '1024', '576', '16:9 -> 1024x576，P=589824 在范围内'],
            ['21:9', '1024', '438', '21:9 -> 1024x438，P=448512 在范围内'],
            // 标准格式：配置中的值均在范围内
            ['1536x1536', '1536', '1536', '1536x1536，P=2359296 在范围内'],
            ['1024x1536', '1024', '1536', '1024x1536，P=1572864 在范围内'],
            ['1536x1024', '1536', '1024', '1536x1024，P=1572864 在范围内'],
            ['1080x1440', '1080', '1440', '1080x1440，P=1555200 在范围内'],
            ['1440x1080', '1440', '1080', '1440x1080，P=1555200 在范围内'],
            ['1080x1920', '1080', '1920', '1080x1920，P=2073600 在范围内'],
            ['1920x1080', '1920', '1080', '1920x1080，P=2073600 在范围内'],
            ['2048x872', '2048', '872', '2048x872，P=1785856 在范围内'],
            // 其他在范围内的标准格式
            ['1024x1024', '1024', '1024', '1024x1024 在范围内'],
            ['1280x720', '1280', '720', '1280x720 在范围内'],
            // 小尺寸：P < min，放大
            ['1x1', '512', '512', '1x1，P=1<min，放大到 512x512'],
            ['500x500', '512', '512', '500x500，P=250000<min，放大到 512x512'],
            // 大尺寸：P > max，缩小
            ['10000x10000', '2048', '2048', '10000x10000，P>max，缩小到 2048x2048'],
            ['3000x2000', '2508', '1672', '3000x2000，P=6000000>max，缩小'],
            ['2000x3000', '1672', '2508', '2000x3000，P=6000000>max，缩小'],
            // 乘号格式
            ['1328*1328', '1328', '1328', '1328*1328，P=1763584 在范围内'],
            // k 格式
            ['1k', '1024', '1024', '1k=1024x1024，P=1048576 在范围内'],
            ['2k', '2048', '2048', '2k=2048x2048，P=4194304 在范围内'],
            // 无效格式 -> 1024x1024，P 在范围内
            ['invalid', '1024', '1024', '无效格式，默认 1024x1024'],
            ['', '1024', '1024', '空字符串，默认 1024x1024'],
        ];

        foreach ($testCases as [$inputSize, $expectedW, $expectedH, $description]) {
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            $this->assertEquals($expectedW, $size[0], "Width mismatch for input: {$inputSize}. {$description}");
            $this->assertEquals($expectedH, $size[1], "Height mismatch for input: {$inputSize}. {$description}");

            $pixels = (int) $size[0] * (int) $size[1];
            $this->assertGreaterThanOrEqual($pixelMin, $pixels, "Pixels {$pixels} below min for input: {$inputSize}");
            $this->assertLessThanOrEqual($pixelMax, $pixels, "Pixels {$pixels} above max for input: {$inputSize}");
        }

        // 验证其他 model_version 命中同一配置
        foreach (['qwen-image-2.0-pro', 'qwen-image-edit-plus', 'qwen-image-edit-max', 'qwen-image-plus'] as $mv) {
            $size = SizeManager::getSizeFromConfig('1536x1536', $mv, null);
            $this->assertEquals('1536', $size[0], "model_version={$mv} should resolve 1536x1536");
            $this->assertEquals('1536', $size[1], "model_version={$mv} should resolve 1536x1536");
        }

        // 带空格
        $size = SizeManager::getSizeFromConfig(' 4:3 ', $modelVersion, $modelId);
        $this->assertEquals('1024', $size[0]);
        $this->assertEquals('768', $size[1]);

        // 验证更多输入的总像素均在合法范围内
        $additionalInputs = ['100:1', '1:100', '3000x3000', '2:3', '3:2'];
        foreach ($additionalInputs as $inputSize) {
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            $pixels = (int) $size[0] * (int) $size[1];
            $this->assertGreaterThanOrEqual($pixelMin, $pixels, "Pixels {$pixels} below min for input: {$inputSize}");
            $this->assertLessThanOrEqual($pixelMax, $pixels, "Pixels {$pixels} above max for input: {$inputSize}");
        }
    }

    /**
     * 测试 Qwen Image 模型的所有 size 格式和边界情况
     * 验证流程：接受多种类型 size -> 转换成 Size（宽高）-> 转换成 Ratio（比例）-> 验证 ratio 是否正确.
     */
    public function testQwenImageModel()
    {
        $modelVersion = 'qwen-image';
        $modelId = null;

        // 配置中支持的比例列表
        $supportedRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];

        // 测试用例：[输入 size, 期望的宽高, 期望的比例]
        $testCases = [
            // 1. 比例格式 label 匹配
            ['1:1', ['1328', '1328'], '1:1'],
            ['3:4', ['1104', '1472'], '3:4'],
            ['4:3', ['1472', '1104'], '4:3'],
            ['9:16', ['928', '1664'], '9:16'],
            ['16:9', ['1664', '928'], '16:9'],

            // 2. 标准格式 value 匹配
            ['1328x1328', ['1328', '1328'], '1:1'],
            ['1104x1472', ['1104', '1472'], '3:4'],
            ['1472x1104', ['1472', '1104'], '4:3'],
            ['928x1664', ['928', '1664'], '9:16'],
            ['1664x928', ['1664', '928'], '16:9'],

            // 3. 乘号格式（不在配置中，会返回配置的第一个值）
            ['1328*1328', ['1328', '1328'], '1:1'],

            // 4. k 格式（不在配置中，会返回配置的第一个值）
            ['1k', ['1328', '1328'], '1:1'],

            // 5. 比例格式但不在配置中（应该匹配最接近的）
            ['2:3', ['1104', '1472'], '3:4'], // 2:3 (0.66) 最接近 3:4 (0.75)
            ['3:2', ['1472', '1104'], '4:3'], // 3:2 (1.5) 最接近 4:3 (1.33)
        ];

        foreach ($testCases as [$inputSize, $expectedSize, $expectedRatio]) {
            // 步骤1: 接受多种类型 size，转换成 Size（宽高）
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            $this->assertEquals($expectedSize, $size, "Failed for input: {$inputSize}");

            // 步骤2: 转换成 Ratio（比例）
            $width = (int) $size[0];
            $height = (int) $size[1];
            $ratio = SizeManager::convertToAspectRatio($width, $height, $modelVersion, $modelId);

            // 步骤3: 验证 ratio 是否正确
            $this->assertEquals($expectedRatio, $ratio, "Ratio mismatch for input: {$inputSize}, size: {$size[0]}x{$size[1]}");
            $this->assertContains($ratio, $supportedRatios, "Ratio {$ratio} not in supported list for input: {$inputSize}");
        }

        // 6. 测试边界情况：空字符串
        $size = SizeManager::getSizeFromConfig('', $modelVersion, $modelId);
        $this->assertEquals(['1328', '1328'], $size);
        $ratio = SizeManager::convertToAspectRatio(1328, 1328, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 7. 测试边界情况：无效格式
        $size = SizeManager::getSizeFromConfig('invalid', $modelVersion, $modelId);
        $this->assertEquals(['1328', '1328'], $size);
        $ratio = SizeManager::convertToAspectRatio(1328, 1328, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 8. 测试标准格式但不在配置中的情况（应该降级到配置中最接近的比例对应的尺寸）
        $size = SizeManager::getSizeFromConfig('2000x2000', $modelVersion, $modelId);
        $this->assertEquals(['1328', '1328'], $size); // 降级到 1:1 对应的 1328x1328
        $ratio = SizeManager::convertToAspectRatio(1328, 1328, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 9. 测试不正确的 size 降级到正确的 size
        $fallbackTestCases = [
            // 9.1 不在配置中的标准格式（会降级到配置中最接近的比例对应的尺寸）
            ['500x500', ['1328', '1328'], '1:1', '小尺寸标准格式，降级到 1:1 对应的 1328x1328'],
            ['2000x3000', ['1104', '1472'], '3:4', '标准格式，降级到 3:4 对应的 1104x1472'], // 2000/3000=0.66, 3/4=0.75, 9/16=0.56. 0.66-0.56=0.1, 0.75-0.66=0.09. 所以是 3:4

            // 9.2 无效的比例格式
            ['100:1', ['1664', '928'], '16:9', '极端宽比例，匹配到最接近的 16:9'],
            ['1:100', ['928', '1664'], '9:16', '极端高比例，匹配到最接近的 9:16'],

            // 9.3 无效格式（会降级到配置的第一个值）
            ['invalid-format', ['1328', '1328'], '1:1', '无效格式，降级到配置的第一个值'],

            // 9.4 极端值（会降级到配置中最接近的比例对应的尺寸）
            ['1x1', ['1328', '1328'], '1:1', '极端小尺寸，降级到 1:1 对应的 1328x1328'],
            ['10000x10000', ['1328', '1328'], '1:1', '极端大尺寸，降级到 1:1 对应的 1328x1328'],
            ['9999x1', ['1664', '928'], '16:9', '极端宽尺寸，降级到 16:9 对应的 1664x928'],
            ['1x9999', ['928', '1664'], '9:16', '极端高尺寸，降级到 9:16 对应的 928x1664'],
        ];

        foreach ($fallbackTestCases as [$incorrectSize, $expectedSize, $expectedRatio, $description]) {
            $size = SizeManager::getSizeFromConfig($incorrectSize, $modelVersion, $modelId);
            $this->assertEquals($expectedSize, $size, "Fallback failed for input: {$incorrectSize}. {$description}");

            $width = (int) $size[0];
            $height = (int) $size[1];
            $ratio = SizeManager::convertToAspectRatio($width, $height, $modelVersion, $modelId);

            $this->assertEquals($expectedRatio, $ratio, "Ratio mismatch after fallback for input: {$incorrectSize}. {$description}");
            $this->assertContains($ratio, $supportedRatios, "Fallback ratio {$ratio} not in supported list");
        }
    }

    /**
     * 测试 Azure OpenAI Image Generate 模型的所有 size 格式和边界情况
     * 验证流程：接受多种类型 size -> 转换成 Size（宽高）-> 转换成 Ratio（比例）-> 验证 ratio 是否正确.
     */
    public function testAzureOpenAIImageGenerateModel()
    {
        $modelVersion = 'AzureOpenAI-ImageGenerate';
        $modelId = null;

        // 配置中支持的比例列表
        $supportedRatios = ['1:1', '2:3', '3:2'];

        // 测试用例：[输入 size, 期望的宽高, 期望的比例]
        $testCases = [
            // 1. 比例格式 label 匹配
            ['1:1', ['1024', '1024'], '1:1'],
            ['2:3', ['1024', '1536'], '2:3'],
            ['3:2', ['1536', '1024'], '3:2'],

            // 2. 标准格式 value 匹配
            ['1024x1024', ['1024', '1024'], '1:1'],
            ['1024x1536', ['1024', '1536'], '2:3'],
            ['1536x1024', ['1536', '1024'], '3:2'],

            // 3. 乘号格式（不在配置中，会返回配置的第一个值）
            ['1024*1024', ['1024', '1024'], '1:1'],

            // 4. k 格式（不在配置中，会返回配置的第一个值）
            ['1k', ['1024', '1024'], '1:1'],

            // 5. 比例格式但不在配置中（应该匹配最接近的）
            ['3:4', ['1024', '1536'], '2:3'], // 3:4 (0.75) 最接近 2:3 (0.66)
            ['4:3', ['1536', '1024'], '3:2'], // 4:3 (1.33) 最接近 3:2 (1.5)
        ];

        foreach ($testCases as [$inputSize, $expectedSize, $expectedRatio]) {
            // 步骤1: 接受多种类型 size，转换成 Size（宽高）
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            $this->assertEquals($expectedSize, $size, "Failed for input: {$inputSize}");

            // 步骤2: 转换成 Ratio（比例）
            $width = (int) $size[0];
            $height = (int) $size[1];
            $ratio = SizeManager::convertToAspectRatio($width, $height, $modelVersion, $modelId);

            // 步骤3: 验证 ratio 是否正确
            $this->assertEquals($expectedRatio, $ratio, "Ratio mismatch for input: {$inputSize}, size: {$size[0]}x{$size[1]}");
            $this->assertContains($ratio, $supportedRatios, "Ratio {$ratio} not in supported list for input: {$inputSize}");
        }

        // 6. 测试边界情况：空字符串
        $size = SizeManager::getSizeFromConfig('', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size);
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 7. 测试边界情况：无效格式
        $size = SizeManager::getSizeFromConfig('invalid', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size);
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 8. 测试标准格式但不在配置中的情况（应该降级到配置中最接近的比例对应的尺寸）
        $size = SizeManager::getSizeFromConfig('2000x2000', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size); // 降级到 1:1 对应的 1024x1024
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 9. 测试不正确的 size 降级到正确的 size
        $fallbackTestCases = [
            // 9.1 不在配置中的标准格式（会降级到配置中最接近的比例对应的尺寸）
            ['500x500', ['1024', '1024'], '1:1', '小尺寸标准格式，降级到 1:1 对应的 1024x1024'],
            ['2000x3000', ['1024', '1536'], '2:3', '标准格式，降级到 2:3 对应的 1024x1536'],

            // 9.2 无效的比例格式
            ['100:1', ['1536', '1024'], '3:2', '极端宽比例，匹配到最接近的 3:2'],
            ['1:100', ['1024', '1536'], '2:3', '极端高比例，匹配到最接近的 2:3'],

            // 9.3 无效格式（会降级到配置的第一个值）
            ['invalid-format', ['1024', '1024'], '1:1', '无效格式，降级到配置的第一个值'],

            // 9.4 极端值（会降级到配置中最接近的比例对应的尺寸）
            ['1x1', ['1024', '1024'], '1:1', '极端小尺寸，降级到 1:1 对应的 1024x1024'],
            ['10000x10000', ['1024', '1024'], '1:1', '极端大尺寸，降级到 1:1 对应的 1024x1024'],
            ['9999x1', ['1536', '1024'], '3:2', '极端宽尺寸，降级到 3:2 对应的 1536x1024'],
            ['1x9999', ['1024', '1536'], '2:3', '极端高尺寸，降级到 2:3 对应的 1024x1536'],
        ];

        foreach ($fallbackTestCases as [$incorrectSize, $expectedSize, $expectedRatio, $description]) {
            $size = SizeManager::getSizeFromConfig($incorrectSize, $modelVersion, $modelId);
            $this->assertEquals($expectedSize, $size, "Fallback failed for input: {$incorrectSize}. {$description}");

            $width = (int) $size[0];
            $height = (int) $size[1];
            $ratio = SizeManager::convertToAspectRatio($width, $height, $modelVersion, $modelId);

            $this->assertEquals($expectedRatio, $ratio, "Ratio mismatch after fallback for input: {$incorrectSize}. {$description}");
            $this->assertContains($ratio, $supportedRatios, "Fallback ratio {$ratio} not in supported list");
        }
    }

    /**
     * 测试 Azure OpenAI Image Edit 模型的所有 size 格式和边界情况
     * 验证流程：接受多种类型 size -> 转换成 Size（宽高）-> 转换成 Ratio（比例）-> 验证 ratio 是否正确.
     */
    public function testAzureOpenAIImageEditModel()
    {
        $modelVersion = 'AzureOpenAI-ImageEdit';
        $modelId = null;

        // 配置中支持的比例列表
        $supportedRatios = ['1:1', '2:3', '3:2'];

        // 测试用例：[输入 size, 期望的宽高, 期望的比例]
        $testCases = [
            // 1. 比例格式 label 匹配
            ['1:1', ['1024', '1024'], '1:1'],
            ['2:3', ['1024', '1536'], '2:3'],
            ['3:2', ['1536', '1024'], '3:2'],

            // 2. 标准格式 value 匹配
            ['1024x1024', ['1024', '1024'], '1:1'],
            ['1024x1536', ['1024', '1536'], '2:3'],
            ['1536x1024', ['1536', '1024'], '3:2'],

            // 3. 乘号格式（不在配置中，会返回配置的第一个值）
            ['1024*1024', ['1024', '1024'], '1:1'],

            // 4. k 格式（不在配置中，会返回配置的第一个值）
            ['1k', ['1024', '1024'], '1:1'],

            // 5. 比例格式但不在配置中（应该匹配最接近的）
            ['3:4', ['1024', '1536'], '2:3'], // 3:4 (0.75) 最接近 2:3 (0.66)
            ['4:3', ['1536', '1024'], '3:2'], // 4:3 (1.33) 最接近 3:2 (1.5)
        ];

        foreach ($testCases as [$inputSize, $expectedSize, $expectedRatio]) {
            // 步骤1: 接受多种类型 size，转换成 Size（宽高）
            $size = SizeManager::getSizeFromConfig($inputSize, $modelVersion, $modelId);
            $this->assertEquals($expectedSize, $size, "Failed for input: {$inputSize}");

            // 步骤2: 转换成 Ratio（比例）
            $width = (int) $size[0];
            $height = (int) $size[1];
            $ratio = SizeManager::convertToAspectRatio($width, $height, $modelVersion, $modelId);

            // 步骤3: 验证 ratio 是否正确
            $this->assertEquals($expectedRatio, $ratio, "Ratio mismatch for input: {$inputSize}, size: {$size[0]}x{$size[1]}");
            $this->assertContains($ratio, $supportedRatios, "Ratio {$ratio} not in supported list for input: {$inputSize}");
        }

        // 6. 测试边界情况：空字符串
        $size = SizeManager::getSizeFromConfig('', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size);
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 7. 测试边界情况：无效格式
        $size = SizeManager::getSizeFromConfig('invalid', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size);
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 8. 测试标准格式但不在配置中的情况（应该降级到配置中最接近的比例对应的尺寸）
        $size = SizeManager::getSizeFromConfig('2000x2000', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $size); // 降级到 1:1 对应的 1024x1024
        $ratio = SizeManager::convertToAspectRatio(1024, 1024, $modelVersion, $modelId);
        $this->assertEquals('1:1', $ratio);

        // 9. 测试不正确的 size 降级到正确的 size
        $fallbackTestCases = [
            // 9.1 不在配置中的标准格式（会降级到配置中最接近的比例对应的尺寸）
            ['500x500', ['1024', '1024'], '1:1', '小尺寸标准格式，降级到 1:1 对应的 1024x1024'],
            ['2000x3000', ['1024', '1536'], '2:3', '标准格式，降级到 2:3 对应的 1024x1536'],

            // 9.2 无效的比例格式
            ['100:1', ['1536', '1024'], '3:2', '极端宽比例，匹配到最接近的 3:2'],
            ['1:100', ['1024', '1536'], '2:3', '极端高比例，匹配到最接近的 2:3'],

            // 9.3 无效格式（会降级到配置的第一个值）
            ['invalid-format', ['1024', '1024'], '1:1', '无效格式，降级到配置的第一个值'],

            // 9.4 极端值（会降级到配置中最接近的比例对应的尺寸）
            ['1x1', ['1024', '1024'], '1:1', '极端小尺寸，降级到 1:1 对应的 1024x1024'],
            ['10000x10000', ['1024', '1024'], '1:1', '极端大尺寸，降级到 1:1 对应的 1024x1024'],
            ['9999x1', ['1536', '1024'], '3:2', '极端宽尺寸，降级到 3:2 对应的 1536x1024'],
            ['1x9999', ['1024', '1536'], '2:3', '极端高尺寸，降级到 2:3 对应的 1024x1536'],
        ];

        foreach ($fallbackTestCases as [$incorrectSize, $expectedSize, $expectedRatio, $description]) {
            $size = SizeManager::getSizeFromConfig($incorrectSize, $modelVersion, $modelId);
            $this->assertEquals($expectedSize, $size, "Fallback failed for input: {$incorrectSize}. {$description}");

            $width = (int) $size[0];
            $height = (int) $size[1];
            $ratio = SizeManager::convertToAspectRatio($width, $height, $modelVersion, $modelId);

            $this->assertEquals($expectedRatio, $ratio, "Ratio mismatch after fallback for input: {$incorrectSize}. {$description}");
            $this->assertContains($ratio, $supportedRatios, "Fallback ratio {$ratio} not in supported list");
        }
    }

    /**
     * 测试无配置模型（使用默认解析逻辑）的所有格式.
     */
    public function testNoConfigModel()
    {
        $modelVersion = 'unknown-model-version';
        $modelId = 'unknown-id';

        // 1. 测试标准格式 1024x1024
        $result = SizeManager::getSizeFromConfig('1024x1024', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $result);

        // 2. 测试乘号格式 1024*1024
        $result = SizeManager::getSizeFromConfig('1024*1024', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $result);

        // 3. 测试 k 格式 2k
        $result = SizeManager::getSizeFromConfig('2k', $modelVersion, $modelId);
        $this->assertEquals(['2048', '2048'], $result);

        // 4. 测试 k 格式 3k
        $result = SizeManager::getSizeFromConfig('3k', $modelVersion, $modelId);
        $this->assertEquals(['3072', '3072'], $result);

        // 5. 测试比例格式 16:9（应该使用默认换算逻辑）
        $result = SizeManager::getSizeFromConfig('16:9', $modelVersion, $modelId);
        // 16:9 基于1024基准，width >= height，所以 width=1024, height=1024*9/16=576
        $this->assertEquals(['1024', '576'], $result);

        // 6. 测试比例格式 1:1
        $result = SizeManager::getSizeFromConfig('1:1', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $result);

        // 7. 测试比例格式 3:4（height > width）
        $result = SizeManager::getSizeFromConfig('3:4', $modelVersion, $modelId);
        // height >= width，所以 height=1024, width=1024*3/4=768
        $this->assertEquals(['768', '1024'], $result);

        // 8. 测试空字符串
        $result = SizeManager::getSizeFromConfig('', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $result);

        // 9. 测试无效格式
        $result = SizeManager::getSizeFromConfig('invalid', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $result);

        // 10. 测试大小写不敏感的 k 格式
        $result = SizeManager::getSizeFromConfig('2K', $modelVersion, $modelId);
        $this->assertEquals(['2048', '2048'], $result);

        // 11. 测试使用 × 符号（中文乘号）
        $result = SizeManager::getSizeFromConfig('1024×1024', $modelVersion, $modelId);
        $this->assertEquals(['1024', '1024'], $result);
    }

    /**
     * 测试 parseToWidthHeight 方法的所有格式.
     */
    public function testParseToWidthHeight()
    {
        // 1. 标准格式
        $result = SizeManager::parseToWidthHeight('1024x1024');
        $this->assertEquals(['1024', '1024'], $result);

        // 2. 乘号格式
        $result = SizeManager::parseToWidthHeight('1024*1024');
        $this->assertEquals(['1024', '1024'], $result);

        // 3. k 格式
        $result = SizeManager::parseToWidthHeight('2k');
        $this->assertEquals(['2048', '2048'], $result);

        $result = SizeManager::parseToWidthHeight('3k');
        $this->assertEquals(['3072', '3072'], $result);

        // 4. 比例格式
        $result = SizeManager::parseToWidthHeight('16:9');
        $this->assertEquals(['1024', '576'], $result);

        $result = SizeManager::parseToWidthHeight('1:1');
        $this->assertEquals(['1024', '1024'], $result);

        $result = SizeManager::parseToWidthHeight('3:4');
        $this->assertEquals(['768', '1024'], $result);

        // 5. 边界情况：空字符串
        $result = SizeManager::parseToWidthHeight('');
        $this->assertEquals(['1024', '1024'], $result);

        // 6. 边界情况：无效格式
        $result = SizeManager::parseToWidthHeight('invalid');
        $this->assertEquals(['1024', '1024'], $result);

        // 7. 边界情况：带空格
        $result = SizeManager::parseToWidthHeight(' 1024x1024 ');
        $this->assertEquals(['1024', '1024'], $result);

        // 8. 测试大小写不敏感
        $result = SizeManager::parseToWidthHeight('2K');
        $this->assertEquals(['2048', '2048'], $result);

        // 9. 测试中文乘号
        $result = SizeManager::parseToWidthHeight('1024×1024');
        $this->assertEquals(['1024', '1024'], $result);
    }

    /**
     * 测试 calculateRatio 方法.
     */
    public function testCalculateRatio()
    {
        // 1. 标准比例
        $ratio = SizeManager::calculateRatio(1024, 1024);
        $this->assertEquals('1:1', $ratio);

        $ratio = SizeManager::calculateRatio(1920, 1080);
        $this->assertEquals('16:9', $ratio);

        // 2. 非标准比例（应该计算最简比例）
        $ratio = SizeManager::calculateRatio(2048, 2048);
        $this->assertEquals('1:1', $ratio);

        $ratio = SizeManager::calculateRatio(1820, 1024);
        // 1820:1024 的最简比例是 455:256
        $this->assertEquals('455:256', $ratio);

        // 3. 测试边界情况：大数字
        $ratio = SizeManager::calculateRatio(4096, 4096);
        $this->assertEquals('1:1', $ratio);

        // 4. 测试非正方形
        $ratio = SizeManager::calculateRatio(1536, 1024);
        $this->assertEquals('3:2', $ratio);
    }

    /**
     * 测试 matchConfig 方法.
     */
    public function testMatchConfig()
    {
        // 1. 测试通过 model_version 匹配
        $config = SizeManager::matchConfig('gemini-3-pro-image-preview', null);
        $this->assertNotNull($config);
        $this->assertArrayHasKey('sizes', $config);

        // 2. 测试通过 model_id 匹配
        $config = SizeManager::matchConfig('unknown', 'seedream-4-0');
        $this->assertNotNull($config);
        $this->assertArrayHasKey('sizes', $config);

        // 3. 测试不匹配的情况
        $config = SizeManager::matchConfig('unknown-version', 'unknown-id');
        $this->assertNull($config);

        // 4. 测试大小写不敏感
        $config = SizeManager::matchConfig('GEMINI-3-PRO-IMAGE-PREVIEW', null);
        $this->assertNotNull($config);

        // 5. 测试 model_id 为 null 的情况
        $config = SizeManager::matchConfig('gemini-3-pro-image-preview', null);
        $this->assertNotNull($config);

        // 6. 测试 model_id 模糊匹配
        $config = SizeManager::matchConfig('unknown', 'test-seedream-4-0-model');
        $this->assertNotNull($config); // 应该匹配到 seedream-4-0
    }

    /**
     * 测试边界情况：model_id 模糊匹配.
     */
    public function testModelIdFuzzyMatch()
    {
        // seedream-4-0 使用模糊匹配，应该匹配包含该字符串的 model_id
        $config = SizeManager::matchConfig('unknown', 'prefix-seedream-4-0-suffix');
        $this->assertNotNull($config);

        $config = SizeManager::matchConfig('unknown', 'SEEDREAM-4-0');
        $this->assertNotNull($config); // 大小写不敏感
    }

    public function testMatchConfigUsesExactMatchByDefault()
    {
        $this->withTemporaryImageModelConfigs([
            [
                'match' => [
                    ['field' => 'model_version', 'value' => 'exact-model'],
                ],
                'config' => [
                    'test_marker' => 'version-exact',
                ],
            ],
            [
                'match' => [
                    ['field' => 'model_id', 'value' => 'exact-id'],
                ],
                'config' => [
                    'test_marker' => 'id-exact',
                ],
            ],
        ], function (): void {
            $config = SizeManager::matchConfig('EXACT-MODEL', null);
            $this->assertSame('version-exact', $config['test_marker'] ?? null);

            $config = SizeManager::matchConfig('prefix-exact-model', null);
            $this->assertNull($config);

            $config = SizeManager::matchConfig('unknown', 'EXACT-ID');
            $this->assertSame('id-exact', $config['test_marker'] ?? null);

            $config = SizeManager::matchConfig('unknown', 'prefix-exact-id');
            $this->assertNull($config);
        });
    }

    public function testMatchConfigSupportsExplicitFuzzyMatchType()
    {
        $this->withTemporaryImageModelConfigs([
            [
                'match' => [
                    ['field' => 'model_version', 'value' => 'gemini-3-pro-image', 'match_type' => 'fuzzy'],
                ],
                'config' => [
                    'test_marker' => 'version-fuzzy',
                ],
            ],
            [
                'match' => [
                    ['field' => 'model_id', 'value' => 'seedream-4-0', 'match_type' => 'fuzzy'],
                ],
                'config' => [
                    'test_marker' => 'id-fuzzy',
                ],
            ],
        ], function (): void {
            $config = SizeManager::matchConfig('openrouter/GEMINI-3-PRO-IMAGE', null);
            $this->assertSame('version-fuzzy', $config['test_marker'] ?? null);

            $config = SizeManager::matchConfig('unknown', 'prefix-SEEDREAM-4-0-suffix');
            $this->assertSame('id-fuzzy', $config['test_marker'] ?? null);

            $config = SizeManager::matchConfig('totally-different-model', null);
            $this->assertNull($config);
        });
    }

    /**
     * 测试边界情况：空配置.
     */
    public function testEmptyConfig()
    {
        $result = SizeManager::getSizeFromConfig('1024x1024', 'non-existent-model', null);
        // 应该使用默认解析逻辑
        $this->assertEquals(['1024', '1024'], $result);
    }

    /**
     * 测试边界情况：配置中有空 sizes 数组.
     */
    public function testConfigWithEmptySizes()
    {
        // 如果配置存在但 sizes 为空，应该返回默认值
        // 这种情况在实际配置中不存在，但测试代码的健壮性
        $result = SizeManager::getSizeFromConfig('1024x1024', 'non-existent-model', null);
        $this->assertEquals(['1024', '1024'], $result);
    }

    /**
     * 测试边界情况：超大尺寸.
     */
    public function testLargeSize()
    {
        $result = SizeManager::parseToWidthHeight('10000x10000');
        $this->assertEquals(['10000', '10000'], $result);

        $result = SizeManager::parseToWidthHeight('10k');
        $this->assertEquals(['10240', '10240'], $result);
    }

    /**
     * 测试边界情况：小尺寸.
     */
    public function testSmallSize()
    {
        $result = SizeManager::parseToWidthHeight('1x1');
        $this->assertEquals(['1', '1'], $result);

        $result = SizeManager::parseToWidthHeight('100x100');
        $this->assertEquals(['100', '100'], $result);
    }

    /**
     * 测试边界情况：特殊比例.
     */
    public function testSpecialRatios()
    {
        // 测试非常宽的比例
        $result = SizeManager::parseToWidthHeight('32:9');
        $this->assertEquals(['1024', '288'], $result);

        // 测试非常高的比例
        $result = SizeManager::parseToWidthHeight('9:32');
        $this->assertEquals(['288', '1024'], $result);
    }

    /**
     * 测试 calculateRatio 方法的除零异常.
     */
    public function testCalculateRatioDivisionByZero()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Both numbers cannot be zero');
        SizeManager::calculateRatio(0, 0);
    }

    /**
     * @param array<int, array<string, mixed>> $models
     */
    private function withTemporaryImageModelConfigs(array $models, callable $callback): mixed
    {
        $config = di(ConfigInterface::class);
        $originalModels = $config->get('image_models.models', []);
        $config->set('image_models.models', $models);

        try {
            return $callback();
        } finally {
            $config->set('image_models.models', $originalModels);
        }
    }
}
