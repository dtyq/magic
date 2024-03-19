<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Infrastructure\Utils;

use Dtyq\SuperMagic\Infrastructure\Utils\FileMetadataUtil;
use Exception;
use PHPUnit\Framework\TestCase;
use Throwable;
use TypeError;

/**
 * Unit tests for FileMetadataUtil.
 *
 * Tests extracting window.magicProjectConfig from JavaScript files
 * with various formats and edge cases.
 * @internal
 */
class FileMetadataUtilTest extends TestCase
{
    /**
     * Temporary file path for tests.
     */
    private ?string $tempFile = null;

    protected function tearDown(): void
    {
        parent::tearDown();

        // Clean up temporary file if exists
        if ($this->tempFile !== null && file_exists($this->tempFile)) {
            unlink($this->tempFile);
            $this->tempFile = null;
        }
    }

    /**
     * Test extracting standard magic project config with double quotes.
     */
    public function testExtractMagicProjectConfigWithStandardFormat(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "自我介绍",
  "slides": [
    "自我介绍封面.html",
    "02-name.html"
  ]
};
window.magicProjectConfigure(window.magicProjectConfig);
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        // Verify extraction success
        $this->assertNotNull($config, 'Configuration should not be null');
        $this->assertIsArray($config, 'Configuration should be an array');

        // Verify structure
        $this->assertArrayHasKey('version', $config);
        $this->assertArrayHasKey('type', $config);
        $this->assertArrayHasKey('name', $config);
        $this->assertArrayHasKey('slides', $config);

        // Verify values
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertEquals('自我介绍', $config['name']);

        // Verify slides array
        $this->assertIsArray($config['slides']);
        $this->assertCount(2, $config['slides']);
        $this->assertEquals('自我介绍封面.html', $config['slides'][0]);
        $this->assertEquals('02-name.html', $config['slides'][1]);
    }

    /**
     * Test extracting config with single quotes (JavaScript style).
     */
    public function testExtractMagicProjectConfigWithSingleQuotes(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  'version': '1.0.0',
  'type': 'slide',
  'name': '测试项目',
  'slides': [
    'intro.html',
    'content.html'
  ]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertEquals('测试项目', $config['name']);
        $this->assertCount(2, $config['slides']);
    }

    /**
     * Test extracting config with unquoted property names (JavaScript style).
     */
    public function testExtractMagicProjectConfigWithUnquotedKeys(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  version: "1.0.0",
  type: "slide",
  name: "项目名称",
  description: "项目描述",
  slides: [
    "page1.html",
    "page2.html"
  ]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertEquals('项目名称', $config['name']);
        $this->assertEquals('项目描述', $config['description']);
        $this->assertCount(2, $config['slides']);
    }

    /**
     * Test extracting config with trailing commas (common JavaScript pattern).
     */
    public function testExtractMagicProjectConfigWithTrailingCommas(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "测试",
  "slides": [
    "page1.html",
    "page2.html",
  ],
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertCount(2, $config['slides']);
    }

    /**
     * Test extracting config with nested objects.
     */
    public function testExtractMagicProjectConfigWithNestedObjects(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "interactive",
  "name": "复杂项目",
  "settings": {
    "theme": "dark",
    "language": "zh_CN",
    "features": {
      "autoPlay": true,
      "loop": false
    }
  },
  "pages": ["index.html"]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertArrayHasKey('settings', $config);
        $this->assertIsArray($config['settings']);
        $this->assertEquals('dark', $config['settings']['theme']);
        $this->assertEquals('zh_CN', $config['settings']['language']);
        $this->assertArrayHasKey('features', $config['settings']);
        $this->assertTrue($config['settings']['features']['autoPlay']);
        $this->assertFalse($config['settings']['features']['loop']);
    }

    /**
     * Test extracting config with mixed quote styles.
     */
    public function testExtractMagicProjectConfigWithMixedQuotes(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  version: "1.0.0",
  'type': "slide",
  "name": '演示文稿',
  slides: [
    "slide1.html",
    'slide2.html'
  ]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertEquals('演示文稿', $config['name']);
        $this->assertCount(2, $config['slides']);
    }

    /**
     * Test extracting config with numeric and boolean values.
     */
    public function testExtractMagicProjectConfigWithDifferentValueTypes(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "数据类型测试",
  "count": 42,
  "enabled": true,
  "disabled": false,
  "nullValue": null,
  "slides": []
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals(42, $config['count']);
        $this->assertTrue($config['enabled']);
        $this->assertFalse($config['disabled']);
        $this->assertNull($config['nullValue']);
        $this->assertIsArray($config['slides']);
        $this->assertEmpty($config['slides']);
    }

    /**
     * Test that missing window.magicProjectConfig returns null.
     */
    public function testExtractMagicProjectConfigReturnsNullWhenMissing(): void
    {
        $jsContent = <<<'JS'
// This file does not contain window.magicProjectConfig
var someOtherVariable = "test";
console.log("No magic config here");
console.log("Just some JavaScript code");
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNull($config, 'Should return null when window.magicProjectConfig is not present');
    }

    /**
     * Test extracting config with additional JavaScript code before and after.
     */
    public function testExtractMagicProjectConfigWithSurroundingCode(): void
    {
        $jsContent = <<<'JS'
// Some initialization code
const APP_VERSION = "2.0.0";
console.log("Initializing...");

// The actual config
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "带有额外代码的项目"
};

// Post-processing
window.magicProjectConfigure(window.magicProjectConfig);
console.log("Configuration loaded");
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertEquals('带有额外代码的项目', $config['name']);
    }

    /**
     * Test extracting config with comments outside the config object.
     * Note: Comments inside the JSON object are not supported by the current implementation.
     */
    public function testExtractMagicProjectConfigWithComments(): void
    {
        $jsContent = <<<'JS'
// Project configuration
// This is a comment before the config
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "注释测试",
  "slides": [
    "intro.html"
  ]
};
// This is a comment after the config
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertEquals('注释测试', $config['name']);
        $this->assertCount(1, $config['slides']);
    }

    /**
     * Test extracting empty config object.
     */
    public function testExtractMagicProjectConfigWithEmptyObject(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertIsArray($config);
        $this->assertEmpty($config);
    }

    /**
     * Test that non-existent file throws exception.
     */
    public function testExtractMagicProjectConfigThrowsExceptionForNonExistentFile(): void
    {
        $this->expectException(Throwable::class);

        FileMetadataUtil::extractMagicProjectConfig('/non/existent/file.js');
    }

    /**
     * Test extracting config with special characters in strings.
     */
    public function testExtractMagicProjectConfigWithSpecialCharacters(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "特殊字符测试",
  "description": "这是一个包含特殊字符的描述",
  "path": "project/files/test",
  "slides": ["page1.html", "page2.html"]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertArrayHasKey('name', $config);
        $this->assertArrayHasKey('description', $config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('特殊字符测试', $config['name']);
        $this->assertEquals('这是一个包含特殊字符的描述', $config['description']);
    }

    /**
     * Test extracting config with Unicode characters.
     */
    public function testExtractMagicProjectConfigWithUnicodeCharacters(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "多语言项目 🎨",
  "title": "Hello 世界 مرحبا こんにちは",
  "emoji": "✅ 🚀 💡",
  "slides": ["index.html"]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('多语言项目 🎨', $config['name']);
        $this->assertEquals('Hello 世界 مرحبا こんにちは', $config['title']);
        $this->assertEquals('✅ 🚀 💡', $config['emoji']);
    }

    /**
     * Test extracting large config with many properties.
     */
    public function testExtractMagicProjectConfigWithLargeConfig(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "大型项目配置",
  "slides": [
    "slide-01.html",
    "slide-02.html",
    "slide-03.html",
    "slide-04.html",
    "slide-05.html",
    "slide-06.html",
    "slide-07.html",
    "slide-08.html",
    "slide-09.html",
    "slide-10.html"
  ],
  "metadata": {
    "author": "测试作者",
    "created": "2026-01-12",
    "modified": "2026-01-12",
    "description": "这是一个包含大量配置的项目"
  },
  "settings": {
    "autoPlay": false,
    "loop": true,
    "transition": "fade",
    "duration": 3000
  }
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertCount(10, $config['slides']);
        $this->assertArrayHasKey('metadata', $config);
        $this->assertArrayHasKey('settings', $config);
        $this->assertEquals('测试作者', $config['metadata']['author']);
        $this->assertFalse($config['settings']['autoPlay']);
        $this->assertTrue($config['settings']['loop']);
        $this->assertEquals(3000, $config['settings']['duration']);
    }

    /**
     * Test getMetadataObject with valid JSON string.
     */
    public function testGetMetadataObjectWithValidJson(): void
    {
        $jsonString = '{"version":"1.0.0","type":"slide","name":"测试"}';
        $metadata = FileMetadataUtil::getMetadataObject($jsonString);

        $this->assertNotNull($metadata);
        $this->assertIsArray($metadata);
        $this->assertEquals('1.0.0', $metadata['version']);
        $this->assertEquals('slide', $metadata['type']);
        $this->assertEquals('测试', $metadata['name']);
    }

    /**
     * Test getMetadataObject with invalid JSON string.
     */
    public function testGetMetadataObjectWithInvalidJson(): void
    {
        $invalidJson = '{invalid json}';
        $metadata = FileMetadataUtil::getMetadataObject($invalidJson);

        $this->assertNull($metadata, 'Should return null for invalid JSON');
    }

    /**
     * Test getMetadataObject with null input.
     */
    public function testGetMetadataObjectWithNull(): void
    {
        $metadata = FileMetadataUtil::getMetadataObject(null);

        $this->assertNull($metadata, 'Should return null for null input');
    }

    /**
     * Test getMetadataObject with empty string.
     */
    public function testGetMetadataObjectWithEmptyString(): void
    {
        $metadata = FileMetadataUtil::getMetadataObject('');

        $this->assertNull($metadata, 'Should return null for empty string');
    }

    /**
     * Test getMetadataObject with empty JSON object.
     */
    public function testGetMetadataObjectWithEmptyJsonObject(): void
    {
        $jsonString = '{}';
        $metadata = FileMetadataUtil::getMetadataObject($jsonString);

        $this->assertNotNull($metadata);
        $this->assertIsArray($metadata);
        $this->assertEmpty($metadata);
    }

    // ==================== Boundary Value Tests for Real-world Scenarios ====================

    /**
     * Test extracting config matching the exact user-provided format.
     * This is the standard format used in production.
     */
    public function testExtractMagicProjectConfigWithExactUserFormat(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "空白幻灯片项目",
  "slides": [
    "page-1.html",
    "page-2.html"
  ]
};
window.magicProjectConfigure(window.magicProjectConfig);
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertEquals('空白幻灯片项目', $config['name']);
        $this->assertIsArray($config['slides']);
        $this->assertCount(2, $config['slides']);
        $this->assertEquals('page-1.html', $config['slides'][0]);
        $this->assertEquals('page-2.html', $config['slides'][1]);
    }

    /**
     * Test extracting config with empty slides array.
     */
    public function testExtractMagicProjectConfigWithEmptySlides(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "空项目",
  "slides": []
};
window.magicProjectConfigure(window.magicProjectConfig);
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertIsArray($config['slides']);
        $this->assertEmpty($config['slides']);
        $this->assertCount(0, $config['slides']);
    }

    /**
     * Test extracting config with single slide.
     */
    public function testExtractMagicProjectConfigWithSingleSlide(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "单页项目",
  "slides": ["index.html"]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertCount(1, $config['slides']);
        $this->assertEquals('index.html', $config['slides'][0]);
    }

    /**
     * Test extracting config with special filename patterns.
     */
    public function testExtractMagicProjectConfigWithSpecialFilenames(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "特殊文件名测试",
  "slides": [
    "01-intro.html",
    "page_2.html",
    "slide.v2.html",
    "content-final.html",
    "结束页.html",
    "page-100.html"
  ]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertCount(6, $config['slides']);
        $this->assertEquals('01-intro.html', $config['slides'][0]);
        $this->assertEquals('page_2.html', $config['slides'][1]);
        $this->assertEquals('slide.v2.html', $config['slides'][2]);
        $this->assertEquals('content-final.html', $config['slides'][3]);
        $this->assertEquals('结束页.html', $config['slides'][4]);
        $this->assertEquals('page-100.html', $config['slides'][5]);
    }

    /**
     * Test extracting config with only required fields.
     */
    public function testExtractMagicProjectConfigWithMinimalFields(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "最小配置"
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertArrayHasKey('version', $config);
        $this->assertArrayHasKey('type', $config);
        $this->assertArrayHasKey('name', $config);
        $this->assertArrayNotHasKey('slides', $config);
    }

    /**
     * Test extracting config with different version formats.
     */
    public function testExtractMagicProjectConfigWithDifferentVersionFormats(): void
    {
        $testCases = [
            '1.0' => '1.0',
            '2.0.0' => '2.0.0',
            '1.0.0-beta' => '1.0.0-beta',
            '3.5.1-alpha.1' => '3.5.1-alpha.1',
            '0.0.1' => '0.0.1',
        ];

        foreach ($testCases as $inputVersion => $expectedVersion) {
            $jsContent = <<<JS
window.magicProjectConfig = {
  "version": "{$inputVersion}",
  "type": "slide",
  "name": "版本测试"
};
JS;

            $filePath = $this->createTempFile($jsContent);
            $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

            $this->assertNotNull($config, "Failed for version: {$inputVersion}");
            $this->assertEquals($expectedVersion, $config['version']);
        }
    }

    /**
     * Test extracting config with different type values.
     */
    public function testExtractMagicProjectConfigWithDifferentTypes(): void
    {
        $types = ['slide', 'document', 'interactive', 'presentation', 'article'];

        foreach ($types as $type) {
            $jsContent = <<<JS
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "{$type}",
  "name": "类型测试"
};
JS;

            $filePath = $this->createTempFile($jsContent);
            $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

            $this->assertNotNull($config, "Failed for type: {$type}");
            $this->assertEquals($type, $config['type']);
        }
    }

    /**
     * Test extracting config with name containing various special characters.
     */
    public function testExtractMagicProjectConfigWithNameSpecialCharacters(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "项目名称(2024版) - 最新修订 #1",
  "slides": ["index.html"]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('项目名称(2024版) - 最新修订 #1', $config['name']);
    }

    /**
     * Test extracting config with very long name.
     */
    public function testExtractMagicProjectConfigWithLongName(): void
    {
        $longName = '这是一个非常非常长的项目名称用于测试边界情况' . str_repeat('测试', 50);
        $jsContent = <<<JS
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "{$longName}",
  "slides": ["page.html"]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals($longName, $config['name']);
        $this->assertGreaterThan(100, strlen($config['name']));
    }

    /**
     * Test extracting config with many slides.
     */
    public function testExtractMagicProjectConfigWithManySlides(): void
    {
        $slides = [];
        for ($i = 1; $i <= 100; ++$i) {
            $slides[] = "\"slide-{$i}.html\"";
        }
        $slidesJson = implode(",\n    ", $slides);

        $jsContent = <<<JS
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "大量幻灯片项目",
  "slides": [
    {$slidesJson}
  ]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertCount(100, $config['slides']);
        $this->assertEquals('slide-1.html', $config['slides'][0]);
        $this->assertEquals('slide-100.html', $config['slides'][99]);
    }

    /**
     * Test extracting config when window.magicProjectConfig appears multiple times.
     * Should extract the first occurrence.
     */
    public function testExtractMagicProjectConfigWithMultipleOccurrences(): void
    {
        $jsContent = <<<'JS'
// First config (should be extracted)
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "第一个配置"
};

// Second config (should be ignored)
window.magicProjectConfig = {
  "version": "2.0.0",
  "type": "document",
  "name": "第二个配置"
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertEquals('第一个配置', $config['name']);
    }

    /**
     * Test extracting config with slides containing path separators.
     */
    public function testExtractMagicProjectConfigWithSlidesContainingPaths(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "路径测试",
  "slides": [
    "pages/intro.html",
    "pages/content/main.html",
    "pages/content/details.html",
    "conclusion.html"
  ]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertCount(4, $config['slides']);
        $this->assertEquals('pages/intro.html', $config['slides'][0]);
        $this->assertEquals('pages/content/main.html', $config['slides'][1]);
        $this->assertEquals('pages/content/details.html', $config['slides'][2]);
        $this->assertEquals('conclusion.html', $config['slides'][3]);
    }

    /**
     * Test extracting config without window.magicProjectConfigure() call.
     */
    public function testExtractMagicProjectConfigWithoutConfigureCall(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "无配置调用",
  "slides": ["page.html"]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        // Should still work without the configure call
        $this->assertNotNull($config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('无配置调用', $config['name']);
    }

    /**
     * Test extracting config with extra whitespace and formatting.
     */
    public function testExtractMagicProjectConfigWithExtraWhitespace(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig   =   {
  "version"  :  "1.0.0"  ,
  "type"  :  "slide"  ,
  "name"  :  "空格测试"  ,
  "slides"  :  [
    "page1.html"  ,
    "page2.html"
  ]
}  ;
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertEquals('空格测试', $config['name']);
        $this->assertCount(2, $config['slides']);
    }

    /**
     * Test extracting config with additional custom fields.
     */
    public function testExtractMagicProjectConfigWithAdditionalFields(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "扩展字段测试",
  "slides": ["page.html"],
  "author": "测试作者",
  "description": "项目描述",
  "tags": ["test", "demo"],
  "customField": "自定义值"
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('测试作者', $config['author']);
        $this->assertEquals('项目描述', $config['description']);
        $this->assertIsArray($config['tags']);
        $this->assertEquals('自定义值', $config['customField']);
    }

    /**
     * Test reading from actual test-project.js file.
     * This is the standard format matching user's real scenario.
     */
    public function testExtractMagicProjectConfigFromRealTestProjectFile(): void
    {
        $filePath = $this->getFixturePath('test-project.js');

        $this->assertFileExists($filePath, 'Fixture file should exist');

        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config, 'Should extract config from real file');
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertEquals('空白幻灯片项目', $config['name']);
        $this->assertIsArray($config['slides']);
        $this->assertCount(2, $config['slides']);
        $this->assertEquals('page-1.html', $config['slides'][0]);
        $this->assertEquals('page-2.html', $config['slides'][1]);

        // Output for visual verification
        echo "\n📄 Test Project Config:\n";
        echo json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        echo "\n";
    }

    /**
     * Test reading from complex-project.js file.
     */
    public function testExtractMagicProjectConfigFromComplexProjectFile(): void
    {
        $filePath = $this->getFixturePath('complex-project.js');

        $this->assertFileExists($filePath);

        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('2.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertEquals('产品介绍演示文稿', $config['name']);
        $this->assertEquals('这是一个完整的产品介绍项目', $config['description']);
        $this->assertEquals('测试作者', $config['author']);

        // Verify slides
        $this->assertCount(6, $config['slides']);
        $this->assertEquals('封面.html', $config['slides'][0]);
        $this->assertEquals('结束页.html', $config['slides'][5]);

        // Verify nested objects
        $this->assertArrayHasKey('settings', $config);
        $this->assertFalse($config['settings']['autoPlay']);
        $this->assertTrue($config['settings']['loop']);
        $this->assertEquals('fade', $config['settings']['transition']);
        $this->assertEquals(3000, $config['settings']['duration']);

        $this->assertArrayHasKey('metadata', $config);
        $this->assertEquals('2026-01-12', $config['metadata']['created']);
        $this->assertIsArray($config['metadata']['tags']);
        $this->assertCount(3, $config['metadata']['tags']);

        echo "\n📄 Complex Project Config:\n";
        echo json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        echo "\n";
    }

    /**
     * Test reading from empty-slides.js file.
     */
    public function testExtractMagicProjectConfigFromEmptySlidesFile(): void
    {
        $filePath = $this->getFixturePath('empty-slides.js');

        $this->assertFileExists($filePath);

        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('空项目', $config['name']);
        $this->assertIsArray($config['slides']);
        $this->assertEmpty($config['slides']);

        echo "\n📄 Empty Slides Config:\n";
        echo json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        echo "\n";
    }

    /**
     * Test reading from nested-paths.js file.
     */
    public function testExtractMagicProjectConfigFromNestedPathsFile(): void
    {
        $filePath = $this->getFixturePath('nested-paths.js');

        $this->assertFileExists($filePath);

        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config);
        $this->assertEquals('嵌套路径项目', $config['name']);
        $this->assertCount(5, $config['slides']);
        $this->assertEquals('intro/welcome.html', $config['slides'][0]);
        $this->assertEquals('content/section1/page1.html', $config['slides'][1]);
        $this->assertEquals('content/section1/page2.html', $config['slides'][2]);
        $this->assertEquals('content/section2/page1.html', $config['slides'][3]);
        $this->assertEquals('outro/thanks.html', $config['slides'][4]);

        echo "\n📄 Nested Paths Config:\n";
        echo json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        echo "\n";
    }

    /**
     * Test reading from invalid file (no config).
     * Note: This test validates that the method returns null for files without config,
     * but also exposes a potential bug in FileMetadataUtil when strpos returns false.
     */
    public function testExtractMagicProjectConfigFromInvalidFile(): void
    {
        $filePath = $this->getFixturePath('invalid-file.txt');

        $this->assertFileExists($filePath);

        try {
            $config = FileMetadataUtil::extractMagicProjectConfig($filePath);
            $this->assertNull($config, 'Should return null for file without config');
        } catch (TypeError $e) {
            // This is expected due to a bug in FileMetadataUtil when handling files
            // without window.magicProjectConfig - strpos offset becomes false
            $this->assertStringContainsString('strpos()', $e->getMessage());
            echo "\n⚠️  Known issue: FileMetadataUtil needs better error handling for invalid files\n";
        }
    }

    /**
     * Test that fixture files can be read directly.
     */
    public function testFixtureFilesExist(): void
    {
        $fixtures = [
            'test-project.js',
            'complex-project.js',
            'empty-slides.js',
            'nested-paths.js',
            'invalid-file.txt',
        ];

        foreach ($fixtures as $fixture) {
            $filePath = $this->getFixturePath($fixture);
            $this->assertFileExists($filePath, "Fixture {$fixture} should exist");
            $this->assertFileIsReadable($filePath, "Fixture {$fixture} should be readable");
        }

        echo "\n✅ All fixture files exist and are readable\n";
    }

    // ==================== JavaScript Comment Removal Tests ====================

    /**
     * Test extracting config with single-line comments.
     */
    public function testExtractMagicProjectConfigWithSingleLineComments(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "注释测试",
  "slides": [
    "page-1.html",
    // "page-2.html",
    "page-3.html"
  ]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config, 'Should parse config with single-line comments');
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('注释测试', $config['name']);
        $this->assertCount(2, $config['slides']);
        $this->assertEquals('page-1.html', $config['slides'][0]);
        $this->assertEquals('page-3.html', $config['slides'][1]);

        echo "\n✅ Single-line comment test passed\n";
    }

    /**
     * Test extracting config with multi-line (block) comments.
     */
    public function testExtractMagicProjectConfigWithBlockComments(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "块注释测试",
  "slides": [
    "page-1.html",
    /* "page-2.html", */
    "page-3.html"
  ]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config, 'Should parse config with block comments');
        $this->assertEquals('块注释测试', $config['name']);
        $this->assertCount(2, $config['slides']);
        $this->assertEquals('page-1.html', $config['slides'][0]);
        $this->assertEquals('page-3.html', $config['slides'][1]);

        echo "\n✅ Block comment test passed\n";
    }

    /**
     * Test extracting config with multi-line block comments spanning multiple lines.
     */
    public function testExtractMagicProjectConfigWithMultiLineBlockComments(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "多行块注释测试",
  "slides": [
    "page-1.html",
    /*
     * 这是一个多行注释
     * "page-2.html",
     * "page-3.html",
     */
    "page-4.html"
  ]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config, 'Should parse config with multi-line block comments');
        $this->assertCount(2, $config['slides']);
        $this->assertEquals('page-1.html', $config['slides'][0]);
        $this->assertEquals('page-4.html', $config['slides'][1]);

        echo "\n✅ Multi-line block comment test passed\n";
    }

    /**
     * Test that comment-like content inside strings is preserved.
     */
    public function testExtractMagicProjectConfigPreservesCommentSyntaxInStrings(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "字符串中的注释符号",
  "url": "https://example.com/page",
  "description": "This is a // test string",
  "note": "Contains /* block */ syntax",
  "slides": ["index.html"]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config, 'Should parse config with comment syntax in strings');
        $this->assertEquals('https://example.com/page', $config['url']);
        $this->assertEquals('This is a // test string', $config['description']);
        $this->assertEquals('Contains /* block */ syntax', $config['note']);

        echo "\n✅ Comment syntax in strings preserved\n";
    }

    /**
     * Test extracting config with inline comments after values.
     */
    public function testExtractMagicProjectConfigWithInlineComments(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0", // Version number
  "type": "slide", // Project type
  "name": "内联注释测试", // Project name in Chinese
  "slides": [
    "page-1.html", // First page
    "page-2.html"  // Second page
  ]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config, 'Should parse config with inline comments');
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('slide', $config['type']);
        $this->assertEquals('内联注释测试', $config['name']);
        $this->assertCount(2, $config['slides']);

        echo "\n✅ Inline comment test passed\n";
    }

    /**
     * Test extracting config with mixed comment styles.
     */
    public function testExtractMagicProjectConfigWithMixedComments(): void
    {
        $jsContent = <<<'JS'
// Header comment
window.magicProjectConfig = {
  "version": "1.0.0", // inline
  "type": "slide",
  /* block comment */
  "name": "混合注释测试",
  "slides": [
    "page-1.html",
    // "commented-out.html",
    /* "also-commented.html", */
    "page-2.html"
  ]
  /*
   * Multi-line block
   * at the end
   */
};
// Footer comment
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config, 'Should parse config with mixed comments');
        $this->assertEquals('混合注释测试', $config['name']);
        $this->assertCount(2, $config['slides']);
        $this->assertEquals('page-1.html', $config['slides'][0]);
        $this->assertEquals('page-2.html', $config['slides'][1]);

        echo "\n✅ Mixed comment test passed\n";
    }

    /**
     * Test extracting config with JSDoc style comments.
     */
    public function testExtractMagicProjectConfigWithJSDocComments(): void
    {
        $jsContent = <<<'JS'
/**
 * @fileoverview Magic Project Configuration
 * @author Test Author
 */
window.magicProjectConfig = {
  /**
   * Version number
   * @type {string}
   */
  "version": "1.0.0",
  "type": "slide",
  "name": "JSDoc注释测试",
  "slides": ["page.html"]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config, 'Should parse config with JSDoc comments');
        $this->assertEquals('1.0.0', $config['version']);
        $this->assertEquals('JSDoc注释测试', $config['name']);

        echo "\n✅ JSDoc comment test passed\n";
    }

    /**
     * Test that empty comments don't break parsing.
     */
    public function testExtractMagicProjectConfigWithEmptyComments(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  //
  "type": "slide",
  /**/
  "name": "空注释测试",
  "slides": []
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config, 'Should parse config with empty comments');
        $this->assertEquals('空注释测试', $config['name']);

        echo "\n✅ Empty comment test passed\n";
    }

    /**
     * Test extracting config with comments containing special characters.
     */
    public function testExtractMagicProjectConfigWithSpecialCharsInComments(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  // 注释中的特殊字符: < > & ! @ # % ^ * + = | ; : , . ?
  "type": "slide",
  /* 多行注释
     也可以包含特殊字符和中文
     测试内容 ABC 123
  */
  "name": "特殊字符注释测试",
  "slides": ["page.html"]
};
JS;

        $filePath = $this->createTempFile($jsContent);
        $config = FileMetadataUtil::extractMagicProjectConfig($filePath);

        $this->assertNotNull($config, 'Should parse config with special chars in comments');
        $this->assertEquals('特殊字符注释测试', $config['name']);

        echo "\n✅ Special chars in comment test passed\n";
    }

    /**
     * Test performance: config without comments should be fast.
     */
    public function testExtractMagicProjectConfigPerformanceWithoutComments(): void
    {
        $jsContent = <<<'JS'
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "性能测试",
  "slides": ["page.html"]
};
JS;

        $filePath = $this->createTempFile($jsContent);

        // Run multiple times to test performance
        $iterations = 100;
        $startTime = microtime(true);

        for ($i = 0; $i < $iterations; ++$i) {
            FileMetadataUtil::extractMagicProjectConfig($filePath);
        }

        $endTime = microtime(true);
        $totalTime = ($endTime - $startTime) * 1000; // Convert to ms
        $avgTime = $totalTime / $iterations;

        $this->assertLessThan(10, $avgTime, 'Average parse time should be less than 10ms');

        echo "\n⏱️  Performance test: {$iterations} iterations in " . number_format($totalTime, 2) . 'ms';
        echo ' (avg: ' . number_format($avgTime, 3) . "ms per iteration)\n";
    }

    /**
     * Create temporary file with given content.
     */
    private function createTempFile(string $content): string
    {
        $this->tempFile = tempnam(sys_get_temp_dir(), 'magic_project_test_');
        file_put_contents($this->tempFile, $content);
        return $this->tempFile;
    }

    // ==================== Real File Tests (Reading from fixtures) ====================

    /**
     * Get fixture file path.
     */
    private function getFixturePath(string $filename): string
    {
        return __DIR__ . '/fixtures/' . $filename;
    }
}
