<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\OSS;

use Dtyq\CloudFile\Kernel\Struct\ChunkDownloadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;
use Exception;

/**
 * OSS Chunk Upload and Download Test.
 *
 * This test covers:
 * - Chunk upload using FilesystemProxy::uploadByChunks()
 * - Chunk download using FilesystemProxy::downloadByChunks()
 * - File integrity verification
 * - Different chunk configurations
 *
 * @internal
 * @coversNothing
 */
class OSSChunkUploadDownloadTest extends CloudFileBaseTest
{
    private const TEST_PREFIX = 'test-credential/';

    private const TEST_FILE_SIZE = 15 * 1024 * 1024; // 15MB test file

    private const CHUNK_SIZE = 6 * 1024 * 1024;      // 6MB chunk size (minimum 5MB for OSS)

    private string $testFilePath;

    private string $downloadFilePath;

    public function setUp(): void
    {
        parent::setUp();

        // Create test file paths
        $this->testFilePath = sys_get_temp_dir() . '/oss_chunk_test_' . uniqid() . '.dat';
        $this->downloadFilePath = sys_get_temp_dir() . '/oss_chunk_download_' . uniqid() . '.dat';

        // Create test file
        $this->createTestFile($this->testFilePath, self::TEST_FILE_SIZE);
    }

    protected function tearDown(): void
    {
        // Clean up test files
        if (file_exists($this->testFilePath)) {
            unlink($this->testFilePath);
        }
        if (file_exists($this->downloadFilePath)) {
            unlink($this->downloadFilePath);
        }

        parent::tearDown();
    }

    /**
     * Test chunk upload API call.
     */
    public function testChunkUploadApiCall(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        // Create chunk upload configuration
        $chunkConfig = new ChunkUploadConfig(
            self::CHUNK_SIZE,      // chunkSize
            10 * 1024 * 1024,      // threshold (10MB - file is larger, will use chunk upload)
            2,                     // maxConcurrency
            3,                     // maxRetries
            1000                   // retryDelay
        );

        // Create chunk upload file
        $testKey = self::TEST_PREFIX . 'chunk-upload-test-' . uniqid() . '.dat';
        $chunkUploadFile = new ChunkUploadFile(
            $this->testFilePath,
            '',
            $testKey,
            false,  // don't rename
            $chunkConfig
        );

        echo "\n🚀 Starting chunk upload: " . round(filesize($this->testFilePath) / 1024 / 1024, 2) . "MB\n";

        // Perform chunk upload
        $startTime = microtime(true);
        $filesystem->uploadByChunks($chunkUploadFile, $credentialPolicy);
        $endTime = microtime(true);

        $duration = round($endTime - $startTime, 2);
        $speed = round((filesize($this->testFilePath) / 1024 / 1024) / $duration, 2);

        echo "✅ Chunk upload completed in {$duration}s at {$speed}MB/s\n";

        // Verify the file was uploaded successfully
        $this->assertNotEmpty($chunkUploadFile->getKey(), 'Upload should return a valid key');

        // Wait and retry to get correct metadata (OSS may need time to sync after chunk upload)
        $originalSize = filesize($this->testFilePath);
        $uploadedSize = 0;
        $maxRetries = 5;

        for ($i = 0; $i < $maxRetries; ++$i) {
            if ($i > 0) {
                echo "🔄 Retry #{$i} getting metadata...\n";
                sleep(2); // Wait longer for subsequent retries
            } else {
                sleep(1); // Initial wait
            }

            $metadata = $filesystem->getHeadObjectByCredential($credentialPolicy, $chunkUploadFile->getKey());
            $uploadedSize = (int) $metadata['content_length'];

            echo '📊 Attempt #' . ($i + 1) . ": Original size: {$originalSize} bytes, Uploaded size: {$uploadedSize} bytes\n";

            if ($uploadedSize > 0) {
                echo '✅ Got correct file size on attempt #' . ($i + 1) . "\n";
                break;
            }
        }

        // If still 0, try to verify via list
        if ($uploadedSize === 0) {
            echo "⚠️  Content length still 0 after {$maxRetries} retries, checking via list...\n";
            $listResult = $filesystem->listObjectsByCredential($credentialPolicy, self::TEST_PREFIX);
            $foundFile = false;

            if (isset($listResult['objects'])) {
                foreach ($listResult['objects'] as $object) {
                    if ($object['key'] === $chunkUploadFile->getKey()) {
                        echo '✅ File found in list with size: ' . $object['size'] . " bytes\n";
                        echo '📋 List metadata: ' . json_encode($object, JSON_PRETTY_PRINT) . "\n";
                        $foundFile = true;

                        // Use the size from list as verification
                        $uploadedSize = (int) $object['size'];
                        break;
                    }
                }
            }

            if (! $foundFile) {
                echo "❌ File not found in object list\n";
            }
        }

        // Verify the upload was successful
        $this->assertNotEmpty($chunkUploadFile->getKey(), 'Upload should return a valid key');
        $this->assertEquals($originalSize, $uploadedSize, 'Uploaded file size should match original file size (from head or list)');

        // Clean up
        $this->cleanupUploadedFile($filesystem, $credentialPolicy, $chunkUploadFile->getKey());
    }

    /**
     * Test small file chunk upload (should still work but may use different strategy).
     */
    public function testSmallFileChunkUpload(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        // Create small test file (1MB)
        $smallFilePath = sys_get_temp_dir() . '/small_chunk_test_' . uniqid() . '.txt';
        $this->createTestFile($smallFilePath, 1024 * 1024); // 1MB

        try {
            $chunkConfig = new ChunkUploadConfig(
                self::CHUNK_SIZE,      // chunkSize
                2 * 1024 * 1024,       // threshold (2MB - file is smaller, may use simple upload)
                2,                     // maxConcurrency
                3,                     // maxRetries
                1000                   // retryDelay
            );

            $testKey = self::TEST_PREFIX . 'small-chunk-test-' . uniqid() . '.txt';
            $chunkUploadFile = new ChunkUploadFile(
                $smallFilePath,
                '',
                $testKey,
                false,
                $chunkConfig
            );

            echo "\n📤 Uploading small file via chunks: " . round(filesize($smallFilePath) / 1024, 2) . "KB\n";

            $filesystem->uploadByChunks($chunkUploadFile, $credentialPolicy);

            $this->assertNotEmpty($chunkUploadFile->getKey(), 'Small file chunk upload should succeed');

            // Verify file metadata (with fallback for chunk upload files)
            $metadata = $filesystem->getHeadObjectByCredential($credentialPolicy, $chunkUploadFile->getKey());
            $uploadedSize = (int) $metadata['content_length'];
            $originalSize = filesize($smallFilePath);

            // If getHeadObjectByCredential returns 0, try list (known issue with multipart uploads)
            if ($uploadedSize === 0) {
                $listResult = $filesystem->listObjectsByCredential($credentialPolicy, self::TEST_PREFIX);
                if (isset($listResult['objects'])) {
                    foreach ($listResult['objects'] as $object) {
                        if ($object['key'] === $chunkUploadFile->getKey()) {
                            $uploadedSize = (int) $object['size'];
                            break;
                        }
                    }
                }
            }

            $this->assertEquals($originalSize, $uploadedSize);

            // Clean up
            $this->cleanupUploadedFile($filesystem, $credentialPolicy, $chunkUploadFile->getKey());
        } finally {
            if (file_exists($smallFilePath)) {
                unlink($smallFilePath);
            }
        }
    }

    /**
     * Test chunk upload configuration options.
     */
    public function testChunkUploadConfiguration(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        // Test with different chunk configuration
        $chunkConfig = new ChunkUploadConfig(
            self::CHUNK_SIZE,      // chunkSize (6MB)
            5 * 1024 * 1024,       // threshold (5MB)
            3,                     // maxConcurrency
            2,                     // maxRetries
            500                    // retryDelay
        );

        $testKey = self::TEST_PREFIX . 'config-test-' . uniqid() . '.dat';
        $chunkUploadFile = new ChunkUploadFile(
            $this->testFilePath,
            '',
            $testKey,
            false,
            $chunkConfig
        );

        echo "\n⚙️  Testing custom chunk configuration\n";

        $filesystem->uploadByChunks($chunkUploadFile, $credentialPolicy);

        $this->assertNotEmpty($chunkUploadFile->getKey());

        // Verify upload (with fallback for chunk upload files)
        $metadata = $filesystem->getHeadObjectByCredential($credentialPolicy, $chunkUploadFile->getKey());
        $uploadedSize = (int) $metadata['content_length'];
        $originalSize = filesize($this->testFilePath);

        // If getHeadObjectByCredential returns 0, try list (known issue with multipart uploads)
        if ($uploadedSize === 0) {
            $listResult = $filesystem->listObjectsByCredential($credentialPolicy, self::TEST_PREFIX);
            if (isset($listResult['objects'])) {
                foreach ($listResult['objects'] as $object) {
                    if ($object['key'] === $chunkUploadFile->getKey()) {
                        $uploadedSize = (int) $object['size'];
                        break;
                    }
                }
            }
        }

        $this->assertEquals($originalSize, $uploadedSize);

        // Clean up
        $this->cleanupUploadedFile($filesystem, $credentialPolicy, $chunkUploadFile->getKey());
    }

    /**
     * Test chunk download API call.
     */
    public function testChunkDownloadApiCall(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        // First, upload a file using createObjectByCredential for testing download
        $testKey = self::TEST_PREFIX . 'download-test-' . uniqid() . '.dat';
        $testContent = str_repeat('TEST DATA CHUNK DOWNLOAD ', 100000); // ~2.5MB

        echo "\n📤 Creating test file for download: " . round(strlen($testContent) / 1024 / 1024, 2) . "MB\n";

        $filesystem->createObjectByCredential(
            $credentialPolicy,
            $testKey,
            [
                'content' => $testContent,
                'content_type' => 'application/octet-stream',
            ]
        );

        // Create chunk download configuration
        $downloadConfig = new ChunkDownloadConfig();
        $downloadConfig->setChunkSize(1024 * 1024); // 1MB chunks (minimum for OSS chunk download)
        $downloadConfig->setMaxConcurrency(3);
        $downloadConfig->setMaxRetries(3);
        $downloadConfig->setRetryDelay(1000);

        echo "📥 Starting chunk download\n";

        // Perform chunk download
        $startTime = microtime(true);
        $filesystem->downloadByChunks($testKey, $this->downloadFilePath, $downloadConfig);
        $endTime = microtime(true);

        $duration = round($endTime - $startTime, 2);
        $downloadedSize = filesize($this->downloadFilePath);
        $speed = round(($downloadedSize / 1024 / 1024) / $duration, 2);

        echo "✅ Chunk download completed in {$duration}s at {$speed}MB/s\n";

        // Verify downloaded file
        $this->assertFileExists($this->downloadFilePath, 'Downloaded file should exist');

        $downloadedContent = file_get_contents($this->downloadFilePath);
        $this->assertEquals(strlen($testContent), strlen($downloadedContent), 'Downloaded file size should match');
        $this->assertEquals($testContent, $downloadedContent, 'Downloaded content should match original');

        echo '📊 Download verification: ' . round($downloadedSize / 1024 / 1024, 2) . "MB downloaded successfully\n";

        // Clean up
        $this->cleanupUploadedFile($filesystem, $credentialPolicy, $testKey);
    }

    /**
     * Test chunk upload vs simple upload comparison (for debugging).
     */
    public function testChunkUploadVsSimpleUpload(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        // Create a test file
        $mediumFilePath = sys_get_temp_dir() . '/medium_test_' . uniqid() . '.dat';
        $this->createTestFile($mediumFilePath, 8 * 1024 * 1024); // 8MB

        try {
            // Test 1: Simple upload via createObjectByCredential
            $simpleKey = self::TEST_PREFIX . 'simple-upload-' . uniqid() . '.dat';
            $fileContent = file_get_contents($mediumFilePath);

            echo "\n🔄 Comparing upload methods for " . round(strlen($fileContent) / 1024 / 1024, 2) . "MB file\n";

            $filesystem->createObjectByCredential(
                $credentialPolicy,
                $simpleKey,
                [
                    'content' => $fileContent,
                    'content_type' => 'application/octet-stream',
                ]
            );

            $simpleMetadata = $filesystem->getHeadObjectByCredential($credentialPolicy, $simpleKey);
            echo '✅ Simple upload - content_length: ' . $simpleMetadata['content_length'] . " bytes\n";

            // Test 2: Chunk upload
            $chunkKey = self::TEST_PREFIX . 'chunk-upload-' . uniqid() . '.dat';
            $chunkConfig = new ChunkUploadConfig(self::CHUNK_SIZE, 1024 * 1024, 2, 3, 1000);
            $chunkUploadFile = new ChunkUploadFile($mediumFilePath, '', $chunkKey, false, $chunkConfig);

            $filesystem->uploadByChunks($chunkUploadFile, $credentialPolicy);

            $chunkMetadata = $filesystem->getHeadObjectByCredential($credentialPolicy, $chunkUploadFile->getKey());
            $chunkSize = (int) $chunkMetadata['content_length'];

            // If getHeadObjectByCredential returns 0, try list (known issue with multipart uploads)
            if ($chunkSize === 0) {
                $listResult = $filesystem->listObjectsByCredential($credentialPolicy, self::TEST_PREFIX);
                if (isset($listResult['objects'])) {
                    foreach ($listResult['objects'] as $object) {
                        if ($object['key'] === $chunkUploadFile->getKey()) {
                            $chunkSize = (int) $object['size'];
                            break;
                        }
                    }
                }
            }

            echo '✅ Chunk upload - content_length: ' . $chunkSize . " bytes\n";

            // Compare results
            $this->assertEquals(
                $simpleMetadata['content_length'],
                $chunkSize,
                'Both upload methods should result in same file size'
            );

            // Clean up
            $this->cleanupUploadedFile($filesystem, $credentialPolicy, $simpleKey);
            $this->cleanupUploadedFile($filesystem, $credentialPolicy, $chunkUploadFile->getKey());
        } finally {
            if (file_exists($mediumFilePath)) {
                unlink($mediumFilePath);
            }
        }
    }

    /**
     * Debug test to check getHeadObjectByCredential response.
     */
    public function testDebugGetHeadObject(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        // First create a test file using createObjectByCredential
        $testKey = self::TEST_PREFIX . 'debug-head-test-' . uniqid() . '.txt';
        $testContent = 'This is a test file for debugging head object response. Content length should be ' . strlen('This is a test file for debugging head object response. Content length should be ') . ' characters.';

        echo "\n🔍 Debug: Creating test file for head object test\n";
        echo '📄 Test content length: ' . strlen($testContent) . " bytes\n";

        // Create the file
        $filesystem->createObjectByCredential(
            $credentialPolicy,
            $testKey,
            [
                'content' => $testContent,
                'content_type' => 'text/plain',
            ]
        );

        echo "✅ Test file created: {$testKey}\n";

        // Wait for consistency
        sleep(2);

        // Now try to get head object
        echo "🔍 Debug: Getting head object metadata...\n";
        $metadata = $filesystem->getHeadObjectByCredential($credentialPolicy, $testKey);

        echo "📋 Raw metadata response:\n";
        var_dump($metadata);

        echo "\n📊 Parsed metadata:\n";
        echo '- content_length: ' . ($metadata['content_length'] ?? 'NOT SET') . "\n";
        echo '- content_type: ' . ($metadata['content_type'] ?? 'NOT SET') . "\n";
        echo '- etag: ' . ($metadata['etag'] ?? 'NOT SET') . "\n";
        echo '- last_modified: ' . ($metadata['last_modified'] ?? 'NOT SET') . "\n";

        // Also try to list the object to compare
        echo "\n🔍 Debug: Listing objects to compare...\n";
        $listResult = $filesystem->listObjectsByCredential($credentialPolicy, self::TEST_PREFIX);

        if (isset($listResult['objects'])) {
            foreach ($listResult['objects'] as $object) {
                if ($object['key'] === $testKey) {
                    echo "📁 Found in list:\n";
                    echo '- key: ' . $object['key'] . "\n";
                    echo '- size: ' . ($object['size'] ?? 'NOT SET') . "\n";
                    echo '- last_modified: ' . ($object['last_modified'] ?? 'NOT SET') . "\n";
                    echo '- etag: ' . ($object['etag'] ?? 'NOT SET') . "\n";
                    break;
                }
            }
        }

        // Basic assertions
        $this->assertIsArray($metadata, 'Metadata should be an array');
        $this->assertArrayHasKey('content_length', $metadata, 'Should have content_length key');

        // Clean up
        $this->cleanupUploadedFile($filesystem, $credentialPolicy, $testKey);
    }

    protected function getStorageName(): string
    {
        return 'aliyun_test';
    }

    /**
     * Create test file with specified size.
     */
    private function createTestFile(string $filePath, int $size): void
    {
        $handle = fopen($filePath, 'wb');
        if (! $handle) {
            $this->fail("Cannot create test file: {$filePath}");
        }

        $chunkSize = 8192;
        $written = 0;

        while ($written < $size) {
            $remaining = $size - $written;
            $writeSize = min($chunkSize, $remaining);
            $data = str_repeat('A', $writeSize);
            fwrite($handle, $data);
            $written += $writeSize;
        }

        fclose($handle);
    }

    /**
     * Create test credential policy.
     */
    private function createTestCredentialPolicy(): CredentialPolicy
    {
        return new CredentialPolicy([
            'sts' => true,
            'roleSessionName' => 'chunk-test',
        ]);
    }

    /**
     * Clean up uploaded file.
     * @param mixed $filesystem
     */
    private function cleanupUploadedFile($filesystem, CredentialPolicy $credentialPolicy, string $key): void
    {
        try {
            $filesystem->deleteObjectByCredential($credentialPolicy, $key);
            echo "🗑️  Cleaned up uploaded file: {$key}\n";
        } catch (Exception $e) {
            echo "⚠️  Failed to clean up uploaded file {$key}: " . $e->getMessage() . "\n";
        }
    }
}
