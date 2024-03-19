<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Infrastructure\Utils;

use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class WorkDirectoryUtilDemoTest extends TestCase
{
    public function testWorkDirectoryValidationDemo(): void
    {
        $userId = 'user123';

        echo "\n" . str_repeat('=', 80) . "\n";
        echo "WorkDirectoryUtil 测试演示 - 路径验证功能\n";
        echo str_repeat('=', 80) . "\n";

        $testCases = [
            // Legacy format (without /workspace)
            '/some/path/SUPER_MAGIC/user123/project_456' => true,
            'SUPER_MAGIC/user123/project_789' => true,

            // New format (with /workspace)
            '/some/path/SUPER_MAGIC/user123/project_456/workspace' => true,
            'SUPER_MAGIC/user123/project_789/workspace' => true,

            // With trailing slash
            '/some/path/SUPER_MAGIC/user123/project_456/' => true,
            '/some/path/SUPER_MAGIC/user123/project_456/workspace/' => true,

            // Invalid cases
            '' => false,
            '/some/path/SUPER_MAGIC/wronguser/project_456' => false,
            '/some/path/SUPER_MAGIC/user123/project_abc' => false,
            '/some/path/SUPER_MAGIC/user123/project_456/invalid_suffix' => false,
            '/some/path/SUPER_MAGIC/user123/wrongformat' => false,
        ];

        echo sprintf("%-60s | %-8s | %-8s\n", '测试路径', '期望', '实际');
        echo str_repeat('-', 80) . "\n";

        foreach ($testCases as $path => $expected) {
            $actual = WorkDirectoryUtil::isValidWorkDirectory($path, $userId);
            $status = $actual === $expected ? '✅ PASS' : '❌ FAIL';

            echo sprintf(
                "%-60s | %-8s | %-8s %s\n",
                $path ?: '[空字符串]',
                $expected ? 'true' : 'false',
                $actual ? 'true' : 'false',
                $status
            );

            $this->assertEquals($expected, $actual, "路径验证失败: {$path}");
        }

        echo "\n";
    }

    public function testProjectIdExtractionDemo(): void
    {
        $userId = 'user123';

        echo str_repeat('=', 80) . "\n";
        echo "WorkDirectoryUtil 测试演示 - 项目ID提取功能\n";
        echo str_repeat('=', 80) . "\n";

        $testCases = [
            // Legacy format
            '/some/path/SUPER_MAGIC/user123/project_456' => '456',
            'SUPER_MAGIC/user123/project_789' => '789',

            // New format (with /workspace)
            '/some/path/SUPER_MAGIC/user123/project_456/workspace' => '456',
            'SUPER_MAGIC/user123/project_789/workspace' => '789',

            // With trailing slash
            '/some/path/SUPER_MAGIC/user123/project_456/' => '456',
            '/some/path/SUPER_MAGIC/user123/project_456/workspace/' => '456',

            // Large project ID
            '/some/path/SUPER_MAGIC/user123/project_123456789/workspace' => '123456789',

            // Invalid cases
            '' => null,
            '/some/path/SUPER_MAGIC/wronguser/project_456' => null,
            '/some/path/SUPER_MAGIC/user123/project_abc' => null,
            '/some/path/SUPER_MAGIC/user123/project_456/invalid_suffix' => null,
            '/some/path/SUPER_MAGIC/user123/wrongformat' => null,
        ];

        echo sprintf("%-60s | %-10s | %-10s\n", '测试路径', '期望ID', '提取ID');
        echo str_repeat('-', 80) . "\n";

        foreach ($testCases as $path => $expectedId) {
            $actualId = WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy($path, $userId);
            $status = $actualId === $expectedId ? '✅ PASS' : '❌ FAIL';

            echo sprintf(
                "%-60s | %-10s | %-10s %s\n",
                $path ?: '[空字符串]',
                $expectedId ?: 'null',
                $actualId ?: 'null',
                $status
            );

            $this->assertEquals($expectedId, $actualId, "项目ID提取失败: {$path}");
        }

        echo "\n";
    }

    public function testCompatibilityDemo(): void
    {
        echo str_repeat('=', 80) . "\n";
        echo "WorkDirectoryUtil 测试演示 - 向下兼容性验证\n";
        echo str_repeat('=', 80) . "\n";

        $userId = 'testuser';
        $projectId = 12345;

        // 使用现有方法生成路径
        $legacyPath = WorkDirectoryUtil::getRootDir($userId, $projectId);
        $newPath = WorkDirectoryUtil::getWorkDir($userId, $projectId);

        echo "生成的路径:\n";
        echo sprintf("Legacy格式 (getRootDir): %s\n", $legacyPath);
        echo sprintf("新格式 (getWorkDir):      %s\n", $newPath);
        echo "\n";

        $testData = [
            ['路径类型', '路径', '验证结果', '提取ID', '状态'],
            ['Legacy', $legacyPath, WorkDirectoryUtil::isValidWorkDirectory($legacyPath, $userId), WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy($legacyPath, $userId), ''],
            ['新格式', $newPath, WorkDirectoryUtil::isValidWorkDirectory($newPath, $userId), WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy($newPath, $userId), ''],
        ];

        foreach ($testData as $index => $row) {
            if ($index === 0) {
                echo sprintf("%-8s | %-50s | %-8s | %-8s | %-8s\n", ...$row);
                echo str_repeat('-', 80) . "\n";
            } else {
                $status = ($row[2] && $row[3] == $projectId) ? '✅ PASS' : '❌ FAIL';
                echo sprintf(
                    "%-8s | %-50s | %-8s | %-8s | %-8s\n",
                    $row[0],
                    $row[1],
                    $row[2] ? 'true' : 'false',
                    $row[3] ?: 'null',
                    $status
                );

                // 断言验证
                $this->assertTrue($row[2], "路径验证失败: {$row[1]}");
                $this->assertEquals((string) $projectId, $row[3], "项目ID提取失败: {$row[1]}");
            }
        }

        echo "\n测试总结: 新旧格式都能正确验证和提取项目ID ✅\n";
        echo str_repeat('=', 80) . "\n";
    }
}
