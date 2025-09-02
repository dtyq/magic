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
class WorkDirectoryUtilTest extends TestCase
{
    public function testIsValidWorkDirectory(): void
    {
        $userId = 'user123';

        // Test legacy format (without /workspace)
        $path = '/some/path/SUPER_MAGIC/user123/project_456';
        $result = WorkDirectoryUtil::isValidWorkDirectory($path, $userId);
        $this->assertTrue($result, "Failed to validate path: {$path}");

        // Test new format (with /workspace)
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            '/some/path/SUPER_MAGIC/user123/project_456/workspace',
            $userId
        ));

        // Test relative path - legacy format
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            'SUPER_MAGIC/user123/project_789',
            $userId
        ));

        // Test relative path - new format
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            'SUPER_MAGIC/user123/project_789/workspace',
            $userId
        ));

        // Test with trailing slash - legacy format
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            '/some/path/SUPER_MAGIC/user123/project_456/',
            $userId
        ));

        // Test with trailing slash - new format
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            '/some/path/SUPER_MAGIC/user123/project_456/workspace/',
            $userId
        ));

        // Test invalid cases
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory('', $userId));
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory('/some/path', ''));
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory('/some/path/SUPER_MAGIC/wronguser/project_456', $userId));
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory('/some/path/SUPER_MAGIC/user123/project_abc', $userId));
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory('/some/path/SUPER_MAGIC/user123/project_456/invalid_suffix', $userId));
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory('/some/path/SUPER_MAGIC/user123/wrongformat', $userId));
    }

    public function testExtractProjectIdFromAbsolutePath(): void
    {
        $userId = 'user123';

        // Test legacy format (without /workspace)
        $this->assertEquals('456', WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy(
            '/some/path/SUPER_MAGIC/user123/project_456',
            $userId
        ));

        // Test new format (with /workspace)
        $this->assertEquals('456', WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy(
            '/some/path/SUPER_MAGIC/user123/project_456/workspace',
            $userId
        ));

        // Test relative path - legacy format
        $path = 'SUPER_MAGIC/user123/project_789';
        $result = WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy($path, $userId);
        $this->assertEquals('789', $result, "Failed to extract project ID from path: {$path}, got: " . ($result ?? 'null'));

        // Test relative path - new format
        $this->assertEquals('789', WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy(
            'SUPER_MAGIC/user123/project_789/workspace',
            $userId
        ));

        // Test with trailing slash - legacy format
        $this->assertEquals('456', WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy(
            '/some/path/SUPER_MAGIC/user123/project_456/',
            $userId
        ));

        // Test with trailing slash - new format
        $this->assertEquals('456', WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy(
            '/some/path/SUPER_MAGIC/user123/project_456/workspace/',
            $userId
        ));

        // Test with larger project ID
        $this->assertEquals('123456789', WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy(
            '/some/path/SUPER_MAGIC/user123/project_123456789/workspace',
            $userId
        ));

        // Test invalid cases
        $this->assertNull(WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy('', $userId));
        $this->assertNull(WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy('/some/path', ''));
        $this->assertNull(WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy('/some/path/SUPER_MAGIC/wronguser/project_456', $userId));
        $this->assertNull(WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy('/some/path/SUPER_MAGIC/user123/project_abc', $userId));
        $this->assertNull(WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy('/some/path/SUPER_MAGIC/user123/project_456/invalid_suffix', $userId));
        $this->assertNull(WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy('/some/path/SUPER_MAGIC/user123/wrongformat', $userId));
    }

    public function testBackwardCompatibility(): void
    {
        $userId = 'testuser';
        $projectId = '12345';

        // Generate expected paths using existing methods
        $legacyPath = WorkDirectoryUtil::getRootDir($userId, (int) $projectId);
        $newPath = WorkDirectoryUtil::getWorkDir($userId, (int) $projectId);

        // Both should be valid
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory($legacyPath, $userId));
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory($newPath, $userId));

        // Both should extract the same project ID
        $this->assertEquals($projectId, WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy($legacyPath, $userId));
        $this->assertEquals($projectId, WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy($newPath, $userId));
    }

    public function testEdgeCases(): void
    {
        $userId = 'user_with_special-chars.123';

        // Test with special characters in user ID
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            '/SUPER_MAGIC/user_with_special-chars.123/project_999',
            $userId
        ));

        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            '/SUPER_MAGIC/user_with_special-chars.123/project_999/workspace',
            $userId
        ));

        $this->assertEquals('999', WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy(
            '/SUPER_MAGIC/user_with_special-chars.123/project_999',
            $userId
        ));

        $this->assertEquals('999', WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy(
            '/SUPER_MAGIC/user_with_special-chars.123/project_999/workspace',
            $userId
        ));

        // Test with project ID 0
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            '/SUPER_MAGIC/user123/project_0/workspace',
            'user123'
        ));

        $this->assertEquals('0', WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy(
            '/SUPER_MAGIC/user123/project_0/workspace',
            'user123'
        ));
    }
}
