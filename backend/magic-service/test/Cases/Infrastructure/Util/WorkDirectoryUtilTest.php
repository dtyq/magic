<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util;

use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use PHPUnit\Framework\TestCase;

/**
 * Comprehensive test suite for WorkDirectoryUtil::isValidDirectoryName method.
 *
 * @internal
 */
class WorkDirectoryUtilTest extends TestCase
{
    /**
     * Test valid directory names that should PASS validation.
     */
    public function testValidDirectoryNames()
    {
        echo "\n=== Testing Valid Directory Names ===\n";

        $validCases = [
            // Basic directory names
            'a' => 'Single character directory',
            'test' => 'Simple directory name',
            'myproject' => 'Regular project directory',
            'MyProject' => 'Mixed case directory',
            'project123' => 'Directory with numbers',

            // Directories with special characters (allowed)
            'my-project' => 'Directory with hyphen',
            'test_dir' => 'Directory with underscore',
            'project.backup' => 'Directory with dot (not at end, not extension-like)',

            // Nested paths
            'a/b' => 'Simple nested path',
            'src/main' => 'Source directory structure',
            'path/to/directory' => 'Deep nested path',
            'project/src/main/java' => 'Very deep nested path',

            // Absolute paths
            '/a' => 'Simple absolute path',
            '/usr/local' => 'System absolute path',
            '/home/user/projects' => 'User directory path',
            '/' => 'Root directory',

            // Hidden directories (the main fix)
            '.git' => 'Git repository metadata',
            '.visual' => 'Visual Studio Code extensions',
            '.vscode' => 'VS Code workspace settings',
            '.github' => 'GitHub workflow configuration',
            '.env' => 'Environment configuration',
            '.docker' => 'Docker configuration',
            '.next' => 'Next.js build directory',
            '.idea' => 'IntelliJ IDEA configuration',
            '.config' => 'Configuration directory',
            '.cache' => 'Cache directory',
            '.npm' => 'NPM cache directory',
            '.yarn' => 'Yarn configuration',

            // Complex paths with hidden directories
            'project/.git' => 'Hidden directory in subdirectory',
            '.config/app' => 'Hidden config with subdirectory',
            'src/.hidden/files' => 'Hidden directory in source path',
            '/home/user/.local/share' => 'Absolute path with hidden directory',

            // Unicode characters (if supported)
            'проект' => 'Directory with Cyrillic characters',
            '项目' => 'Directory with Chinese characters',
            'مشروع' => 'Directory with Arabic characters',
        ];

        $passedCount = 0;
        $totalCount = count($validCases);

        foreach ($validCases as $directoryName => $description) {
            $result = WorkDirectoryUtil::isValidDirectoryName($directoryName);
            $status = $result ? '✅ VALID' : '❌ INVALID';
            echo "  '{$directoryName}': {$status} - {$description}\n";

            $this->assertTrue(
                $result,
                "VALID case failed: '{$directoryName}' - {$description}"
            );

            if ($result) {
                ++$passedCount;
            }
        }

        echo "✅ Valid Directory Names: {$passedCount}/{$totalCount} passed\n";
    }

    /**
     * Test invalid directory names that should FAIL validation.
     */
    public function testInvalidDirectoryNames()
    {
        echo "\n=== Testing Invalid Directory Names ===\n";

        $invalidCases = [
            // Empty and whitespace
            '' => 'Empty string',
            ' ' => 'Single space',
            '  ' => 'Multiple spaces',
            "\t" => 'Tab character',
            "\n" => 'Newline character',

            // Leading/trailing spaces
            ' test' => 'Leading space',
            'test ' => 'Trailing space',
            ' test ' => 'Leading and trailing spaces',
            "\ttest" => 'Leading tab',
            "test\t" => 'Trailing tab',

            // Path traversal attempts
            '..' => 'Parent directory reference',
            '../dir' => 'Path traversal with directory',
            'dir/../other' => 'Path traversal in middle',
            '../../' => 'Multiple level traversal',
            '/../../etc' => 'Absolute path traversal',

            // Windows path separators
            'dir\\' => 'Windows backslash separator',
            'path\to\dir' => 'Windows-style path',
            'mixed/path\style' => 'Mixed path separators',

            // Dangerous characters
            'dir?' => 'Question mark',
            'test*' => 'Asterisk wildcard',
            'name<test>' => 'Angle brackets',
            'dir|pipe' => 'Pipe character',
            'test"quote' => 'Double quote',
            "test'quote" => 'Single quote',
            'dir:colon' => 'Colon character',

            // Control characters
            "test\x00null" => 'Null byte',
            "test\x01control" => 'Control character',
            "test\x1fcontrol" => 'Control character',

            // Windows reserved names
            'CON' => 'Windows reserved name (uppercase)',
            'con' => 'Windows reserved name (lowercase)',
            'PRN' => 'Windows reserved name PRN',
            'AUX' => 'Windows reserved name AUX',
            'NUL' => 'Windows reserved name NUL',
            'COM1' => 'Windows reserved name COM1',
            'COM2' => 'Windows reserved name COM2',
            'LPT1' => 'Windows reserved name LPT1',
            'LPT2' => 'Windows reserved name LPT2',

            // Dot-only patterns
            '.' => 'Current directory reference',
            '...' => 'Three dots',
            '....' => 'Four dots',
            '.....' => 'Five dots',

            // Ending with dots (problematic on Windows)
            'test.' => 'Directory ending with dot',
            'directory.' => 'Directory ending with dot',
            'path/to/dir.' => 'Nested path ending with dot',

            // Files (last component has extension)
            'file.txt' => 'Text file',
            'document.pdf' => 'PDF file',
            'script.js' => 'JavaScript file',
            'style.css' => 'CSS file',
            'image.png' => 'Image file',
            'archive.tar.gz' => 'Archive file with compound extension',
            'dir/file.txt' => 'Path ending with file',
            'project/src/main.java' => 'Deep path ending with file',

            // Components with mixed problematic patterns
            '.   ' => 'Dot with trailing spaces',
            '   .' => 'Spaces with trailing dot',
            '. .' => 'Dots with space',

            // Too long components (over 255 characters)
            str_repeat('a', 256) => 'Component over 255 characters',
            'normal/' . str_repeat('b', 256) => 'Second component over 255 characters',
        ];

        $rejectedCount = 0;
        $totalCount = count($invalidCases);

        foreach ($invalidCases as $directoryName => $description) {
            $result = WorkDirectoryUtil::isValidDirectoryName($directoryName);
            $status = $result ? '❌ VALID (should be invalid)' : '✅ INVALID';
            $displayName = $directoryName === '' ? '[empty string]' : ($directoryName === ' ' ? '[space]' : $directoryName);
            echo "  '{$displayName}': {$status} - {$description}\n";

            $this->assertFalse(
                $result,
                "INVALID case passed: '{$directoryName}' - {$description}"
            );

            if (! $result) {
                ++$rejectedCount;
            }
        }

        echo "✅ Invalid Directory Names: {$rejectedCount}/{$totalCount} correctly rejected\n";
    }

    /**
     * Test specific edge cases and boundary conditions.
     */
    public function testEdgeCases()
    {
        echo "\n=== Testing Edge Cases ===\n";

        // Test maximum valid component length (255 characters)
        $maxValidComponent = str_repeat('a', 255);
        $result = WorkDirectoryUtil::isValidDirectoryName($maxValidComponent);
        $status = $result ? '✅ VALID' : '❌ INVALID';
        echo "  255-character component: {$status}\n";
        $this->assertTrue(
            $result,
            'Component with exactly 255 characters should be valid'
        );

        // Test path with multiple valid components
        $longValidPath = implode('/', array_fill(0, 10, 'validdir'));
        $result = WorkDirectoryUtil::isValidDirectoryName($longValidPath);
        $status = $result ? '✅ VALID' : '❌ INVALID';
        echo "  Multi-level path (10 levels): {$status}\n";
        $this->assertTrue(
            $result,
            'Path with multiple valid components should be valid'
        );

        // Test hidden directory with subdirectory
        $result = WorkDirectoryUtil::isValidDirectoryName('.git/hooks');
        $status = $result ? '✅ VALID' : '❌ INVALID';
        echo "  Hidden directory with subdirectory: {$status}\n";
        $this->assertTrue(
            $result,
            'Hidden directory with subdirectory should be valid'
        );

        // Test directory that looks like hidden but ends with dot (invalid)
        $result = WorkDirectoryUtil::isValidDirectoryName('.config.');
        $status = $result ? '❌ VALID (should be invalid)' : '✅ INVALID';
        echo "  Hidden-like but ends with dot: {$status}\n";
        $this->assertFalse(
            $result,
            'Directory starting with dot but ending with dot should be invalid'
        );

        echo "✅ Edge Cases: All boundary conditions tested\n";
    }

    /**
     * Test the specific fix for hidden directories.
     */
    public function testHiddenDirectoryFix()
    {
        $hiddenDirectories = [
            '.git',
            '.visual',
            '.vscode',
            '.github',
            '.env',
            '.docker',
            '.next',
            '.nuxt',
            '.idea',
            '.vs',
            '.svn',
            '.hg',
            '.bzr',
        ];

        echo "\n=== Testing Hidden Directory Fix ===\n";

        foreach ($hiddenDirectories as $hiddenDir) {
            $result = WorkDirectoryUtil::isValidDirectoryName($hiddenDir);
            echo "Testing '{$hiddenDir}': " . ($result ? '✅ VALID' : '❌ INVALID') . "\n";

            $this->assertTrue(
                $result,
                "Hidden directory '{$hiddenDir}' should be valid after fix"
            );
        }
    }

    /**
     * Test paths that should be invalid due to file extensions.
     */
    public function testFileExtensionRejection()
    {
        echo "\n=== Testing File Extension Rejection ===\n";

        $filePatterns = [
            // Common file types
            'readme.md',
            'package.json',
            'composer.lock',
            'Dockerfile.prod',
            'nginx.conf',
            'app.py',
            'main.go',
            'index.html',
            'style.css',
            'script.js',
            'data.xml',
            'config.yml',
            'settings.ini',

            // Archive files
            'backup.zip',
            'archive.tar',
            'data.tar.gz',
            'source.tar.bz2',

            // Image files
            'logo.png',
            'banner.jpg',
            'icon.svg',
            'photo.gif',

            // Document files
            'report.pdf',
            'letter.doc',
            'sheet.xls',
            'presentation.ppt',
        ];

        $rejectedCount = 0;
        $totalCount = count($filePatterns);

        foreach ($filePatterns as $fileName) {
            $result = WorkDirectoryUtil::isValidDirectoryName($fileName);
            $status = $result ? '❌ VALID (should be invalid)' : '✅ INVALID';
            echo "  '{$fileName}': {$status}\n";

            $this->assertFalse(
                $result,
                "File '{$fileName}' should be rejected as it appears to be a file, not directory"
            );

            if (! $result) {
                ++$rejectedCount;
            }
        }

        echo "✅ File Extension Rejection: {$rejectedCount}/{$totalCount} files correctly rejected\n";
    }
}
