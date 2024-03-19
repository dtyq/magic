<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util;

use App\Infrastructure\Util\FileType;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class FileTypeTest extends TestCase
{
    /**
     * 测试从本地文件获取类型.
     */
    public function testGetTypeFromLocalFile()
    {
        // 创建一个临时文本文件
        $tempFile = tempnam(sys_get_temp_dir(), 'test_');
        file_put_contents($tempFile, 'Hello, World!');

        try {
            // 测试文本文件
            $fileType = FileType::getType($tempFile);
            $this->assertEquals('txt', $fileType, '文本文件应该识别为txt');
        } finally {
            // 清理临时文件
            @unlink($tempFile);
        }
    }

    /**
     * 测试从URL路径获取类型.
     */
    public function testGetTypeFromUrlPath()
    {
        // 测试不同扩展名的URL
        $pdfUrl = 'https://example.com/documents/sample.pdf?param=value';
        $fileType = FileType::getType($pdfUrl);
        $this->assertEquals('pdf', $fileType, 'PDF URL应该识别出pdf扩展名');

        $jpgUrl = 'https://example.com/images/photo.jpg';
        $fileType = FileType::getType($jpgUrl);
        $this->assertEquals('jpg', $fileType, 'JPG URL应该识别出jpg扩展名');

        $docxUrl = 'https://example.com/files/document.docx#section1';
        $fileType = FileType::getType($docxUrl);
        $this->assertEquals('docx', $fileType, 'DOCX URL应该识别出docx扩展名');
    }

    /**
     * 测试使用公共可访问的图片URL.
     */
    public function testRealImageUrl()
    {
        // 使用实际可访问的图像URL进行测试
        $imageUrl = 'https://www.php.net/images/logos/php-logo.svg';
        $fileType = FileType::getType($imageUrl);
        $this->assertEquals('svg', $fileType, '应该正确识别SVG文件');
    }

    /**
     * 测试项目中的 .php-cs-fixer.php 文件.
     */
    public function testProjectPhpCsFixerFile()
    {
        // 获取项目根目录
        $projectRoot = dirname(__DIR__, 4);

        // 测试 .php-cs-fixer.php 文件
        $phpCsFixerFile = $projectRoot . '/.php-cs-fixer.php';

        // 确保文件存在
        $this->assertFileExists($phpCsFixerFile, '.php-cs-fixer.php 文件不存在');

        // 获取文件类型并验证
        $fileType = FileType::getType($phpCsFixerFile);
        $this->assertEquals('php', $fileType, '应该识别为PHP文件');

        // 确认文件内容是否包含特定内容，以验证是正确的文件
        $content = file_get_contents($phpCsFixerFile);
        $this->assertStringContainsString('PhpCsFixer\Config', $content, '文件内容应包含 PhpCsFixer\Config');
    }

    /**
     * 测试从HTTP头信息获取类型（需要模拟HTTP响应）.
     *
     * 注意：这个测试可能需要使用函数模拟，如果项目中没有配置函数模拟，
     * 可以将此测试标记为跳过或使用真实URL进行测试
     */
    public function testGetTypeFromHeaders()
    {
        // 标记此测试为跳过，因为需要模拟全局函数
        $this->markTestSkipped('需要函数模拟功能才能完整测试');
    }

    /**
     * 测试无法识别文件类型时抛出异常.
     * 同样需要函数模拟支持
     */
    public function testInvalidFileType()
    {
        $this->markTestSkipped('需要函数模拟功能才能完整测试');
    }

    /**
     * 测试文件太大的情况.
     */
    public function testFileTooLarge()
    {
        $this->markTestSkipped('需要函数模拟功能才能完整测试');
    }
}
