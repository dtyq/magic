<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Utils;

use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class WorkDirectoryUtilTest extends HttpTestCase
{
    private string $testUserId = '588417216353927169';
    private string $testWorkDirPrefix = 'DT001/588417216353927169';

    /**
     * Test isValidWorkDirectory method with valid paths.
     */
    public function testIsValidWorkDirectoryWithValidPaths(): void
    {
        // Test valid paths with workspace suffix
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            $this->testWorkDirPrefix,
            'DT001/588417216353927169/project_809080575792672768/workspace/'
        ));

        // Test valid paths without workspace suffix
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            $this->testWorkDirPrefix,
            'DT001/588417216353927169/project_123456789'
        ));

        // Test valid paths with workspace (no trailing slash)
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            $this->testWorkDirPrefix,
            'DT001/588417216353927169/project_999/workspace'
        ));

        // Test with different project IDs
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            $this->testWorkDirPrefix,
            'DT001/588417216353927169/project_1'
        ));

        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            $this->testWorkDirPrefix,
            'DT001/588417216353927169/project_999999999999999999/workspace'
        ));
    }

    /**
     * Test isValidWorkDirectory method with invalid paths.
     */
    public function testIsValidWorkDirectoryWithInvalidPaths(): void
    {
        // Test empty parameters
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory('', 'some/path'));
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory($this->testWorkDirPrefix, ''));
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory('', ''));

        // Test wrong prefix
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory(
            'WRONG001/588417216353927169',
            'DT001/588417216353927169/project_123/workspace'
        ));

        // Test wrong user ID in prefix
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory(
            'DT001/wrong-user',
            'DT001/588417216353927169/project_123/workspace'
        ));

        // Test missing project_ format in path
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory(
            $this->testWorkDirPrefix,
            'DT001/588417216353927169/wrong_123'
        ));

        // Test non-numeric project ID
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory(
            $this->testWorkDirPrefix,
            'DT001/588417216353927169/project_abc'
        ));

        // Test paths with extra segments after workspace
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory(
            $this->testWorkDirPrefix,
            'DT001/588417216353927169/project_123/workspace/extra'
        ));

        // Test completely unrelated paths
        $this->assertFalse(WorkDirectoryUtil::isValidWorkDirectory(
            $this->testWorkDirPrefix,
            '/random/path/to/files'
        ));
    }

    /**
     * Test isValidWorkDirectory method with edge cases.
     */
    public function testIsValidWorkDirectoryEdgeCases(): void
    {
        // Test with trailing slashes in prefix
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            'DT001/588417216353927169/',
            'DT001/588417216353927169/project_456/workspace/'
        ));

        // Test with different prefix formats
        $specialPrefix = 'ORG123/user.with+special@chars';
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            $specialPrefix,
            'ORG123/user.with+special@chars/project_123'
        ));

        // Test project ID zero
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectory(
            $this->testWorkDirPrefix,
            'DT001/588417216353927169/project_0/workspace'
        ));
    }

    /**
     * Test extractProjectIdFromAbsolutePath method with valid paths.
     */
    public function testExtractProjectIdFromAbsolutePathWithValidPaths(): void
    {
        // Test extraction from paths with workspace suffix and trailing slash
        $this->assertEquals('809080575792672768', WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            'DT001/588417216353927169/project_809080575792672768/workspace/'
        ));

        // Test extraction from paths without workspace suffix
        $this->assertEquals('123456789', WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            'DT001/588417216353927169/project_123456789'
        ));

        // Test extraction from paths with workspace but no trailing slash
        $this->assertEquals('999', WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            'any/path/project_999/workspace'
        ));

        // Test extraction from simple project paths
        $this->assertEquals('1', WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            'project_1/'
        ));

        $this->assertEquals('888', WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            'project_888'
        ));

        // Test with very long project ID
        $this->assertEquals('999999999999999999', WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            'prefix/project_999999999999999999/workspace/'
        ));
    }

    /**
     * Test extractProjectIdFromAbsolutePath method with invalid paths.
     */
    public function testExtractProjectIdFromAbsolutePathWithInvalidPaths(): void
    {
        // Test with empty parameter
        $this->assertNull(WorkDirectoryUtil::extractProjectIdFromAbsolutePath(''));

        // Test with paths missing project_ pattern
        $this->assertNull(WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            'DT001/588417216353927169/wrong_123/workspace'
        ));

        // Test with non-numeric project ID
        $this->assertNull(WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            'DT001/588417216353927169/project_abc/workspace'
        ));

        // Test completely unrelated paths
        $this->assertNull(WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            '/random/path/to/files'
        ));

        // Test project_ without number
        $this->assertNull(WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            'path/project_/workspace'
        ));
    }

    /**
     * Test extractProjectIdFromAbsolutePath method with edge cases.
     */
    public function testExtractProjectIdFromAbsolutePathEdgeCases(): void
    {
        // Test with zero as project ID
        $this->assertEquals('0', WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            'DT001/588417216353927169/project_0/workspace/'
        ));

        // Test multiple project_ patterns (should match first one)
        $this->assertEquals('123', WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            'path/project_123/subdir/project_456/'
        ));

        // Test project_ at the end without slash
        $this->assertEquals('789', WorkDirectoryUtil::extractProjectIdFromAbsolutePath(
            'some/path/project_789'
        ));
    }

    /**
     * Test both methods working together - consistency check.
     */
    public function testMethodConsistency(): void
    {
        $validPaths = [
            'DT001/588417216353927169/project_809080575792672768/workspace/',
            'DT001/588417216353927169/project_123456789',
            'DT001/588417216353927169/project_999/workspace',
            'DT001/588417216353927169/project_0',
        ];

        foreach ($validPaths as $path) {
            // If isValidWorkDirectory returns true, extractProjectIdFromAbsolutePath should return a valid project ID
            $isValid = WorkDirectoryUtil::isValidWorkDirectory($this->testWorkDirPrefix, $path);
            $projectId = WorkDirectoryUtil::extractProjectIdFromAbsolutePath($path);

            $this->assertTrue($isValid, "Path should be valid: {$path}");
            $this->assertNotNull($projectId, "Valid path should return a project ID: {$path}");
            $this->assertIsString($projectId, "Project ID should be a string: {$path}");
            $this->assertMatchesRegularExpression('/^\d+$/', $projectId, "Project ID should be numeric: {$path}");
        }

        $invalidPaths = [
            'WRONG001/588417216353927169/project_123/workspace',
            'DT001/wrong-user/project_123/workspace',
            'DT001/588417216353927169/wrong_123',
            '/random/path',
        ];

        foreach ($invalidPaths as $path) {
            // Invalid paths should fail validation but may still extract project ID if pattern exists
            $isValid = WorkDirectoryUtil::isValidWorkDirectory($this->testWorkDirPrefix, $path);
            $this->assertFalse($isValid, "Invalid path should return false: {$path}");
        }
    }

    /**
     * Test legacy methods for backward compatibility.
     */
    public function testLegacyMethods(): void
    {
        // Test legacy isValidWorkDirectoryLegacy method
        $this->assertTrue(WorkDirectoryUtil::isValidWorkDirectoryLegacy(
            '/path/to/SUPER_MAGIC/test-user-123/project_456/workspace',
            'test-user-123'
        ));

        // Test legacy extractProjectIdFromAbsolutePathLegacy method
        $this->assertEquals('456', WorkDirectoryUtil::extractProjectIdFromAbsolutePathLegacy(
            '/path/to/SUPER_MAGIC/test-user-123/project_456/workspace',
            'test-user-123'
        ));
    }
} 