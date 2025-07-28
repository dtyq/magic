<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\FileService;

use Dtyq\CloudFile\Kernel\Struct\ChunkDownloadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;
use Exception;

/**
 * FileService OSS Chunk Upload and Download Test.
 *
 * This test covers FileService integration with OSS platform:
 * - Chunk upload using FilesystemProxy::uploadByChunks()
 * - Chunk download using FilesystemProxy::downloadByChunks()
 * - File integrity verification
 * - Different chunk configurations
 * - FileService OSS backend behavior
 * - OSS-specific behavior (content_length=0 for chunked uploads)
 *
 * @internal
 * @coversNothing
 */
class FileServiceOSSChunkUploadDownloadTest extends CloudFileBaseTest
{
    private const TEST_FILE_SIZE = 15 * 1024 * 1024; // 15MB test file

    private const CHUNK_SIZE = 6 * 1024 * 1024;      // 6MB chunk size (OSS minimum 5MB)

    private string $allowedDir = '';

    private string $testPrefix = '';

    private string $testFilePath;

    private string $downloadFilePath;

    public function setUp(): void
    {
        parent::setUp();

        try {
            $filesystem = $this->getFilesystem();
            $credentialPolicy = $this->createOSSCredentialPolicy();

            // Get credential to determine allowed dir
            $credential = $filesystem->getUploadTemporaryCredential($credentialPolicy, $this->getOptions($filesystem->getOptions()));
            $this->allowedDir = $credential['temporary_credential']['dir'] ?? '';

            // Set up test prefix without allowed dir (SDK will add it automatically)
            $this->testPrefix = 'fileservice-oss-chunk/';
        } catch (Exception $e) {
            // Will be handled by getFilesystem() in individual tests
            $this->testPrefix = 'test-credential/'; // Fallback
        }

        // Create test file paths
        $this->testFilePath = sys_get_temp_dir() . '/fileservice_oss_chunk_test_' . uniqid() . '.dat';
        $this->downloadFilePath = sys_get_temp_dir() . '/fileservice_oss_chunk_download_' . uniqid() . '.dat';

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
     * Test chunk upload API call via FileService OSS.
     */
    public function testChunkUploadApiCall(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createOSSCredentialPolicy();

        // Create chunk upload configuration
        $chunkConfig = new ChunkUploadConfig(
            self::CHUNK_SIZE,      // chunkSize
            10 * 1024 * 1024,      // threshold (10MB - file is larger, will use chunk upload)
            2,                     // maxConcurrency
            3,                     // maxRetries
            1000                   // retryDelay
        );

        // Create chunk upload file
        $testKey = $this->testPrefix . 'oss-chunk-upload-test-' . uniqid() . '.dat';
        $chunkUploadFile = new ChunkUploadFile(
            $this->testFilePath,
            '',
            $testKey,
            false,  // don't rename
            $chunkConfig
        );

        echo "\n🚀 Starting FileService OSS chunk upload: " . round(filesize($this->testFilePath) / 1024 / 1024, 2) . "MB\n";

        // Perform chunk upload with FileService options
        $startTime = microtime(true);
        $filesystem->uploadByChunks(
            $chunkUploadFile,
            $credentialPolicy,
            $this->getOptions($filesystem->getOptions())
        );
        $endTime = microtime(true);

        $duration = round($endTime - $startTime, 2);
        $speed = round((filesize($this->testFilePath) / 1024 / 1024) / $duration, 2);

        echo "✅ FileService OSS chunk upload completed in {$duration}s at {$speed}MB/s\n";

        // Verify the file was uploaded successfully
        $this->assertNotEmpty($chunkUploadFile->getKey(), 'Upload should return a valid key');

        // Get file metadata to verify upload (with OSS fallback logic)
        $originalSize = filesize($this->testFilePath);
        $uploadedSize = 0;
        $maxRetries = 5;

        for ($i = 0; $i < $maxRetries; ++$i) {
            if ($i > 0) {
                echo "🔄 Retry #{$i} getting FileService OSS metadata...\n";
                sleep(2); // Wait longer for subsequent retries
            } else {
                sleep(1); // Initial wait
            }

            $metadata = $filesystem->getHeadObjectByCredential(
                $credentialPolicy,
                $chunkUploadFile->getKey(),
                $this->getOptions($filesystem->getOptions())
            );
            $uploadedSize = (int) $metadata['content_length'];

            echo '📊 Attempt #' . ($i + 1) . ": Original size: {$originalSize} bytes, Uploaded size: {$uploadedSize} bytes\n";

            if ($uploadedSize > 0) {
                echo '✅ Got correct file size on attempt #' . ($i + 1) . "\n";
                break;
            }
        }

        // If still 0, try to verify via list (OSS fallback for chunked uploads)
        if ($uploadedSize === 0) {
            echo "⚠️  Content length still 0 after {$maxRetries} retries, checking via FileService OSS list...\n";
            // Use the actual uploaded path prefix (which includes allowedDir twice)
            $actualPrefix = $this->allowedDir . $this->testPrefix;
            $listResult = $filesystem->listObjectsByCredential(
                $credentialPolicy,
                $actualPrefix,
                $this->getOptions($filesystem->getOptions())
            );

            if (isset($listResult['objects'])) {
                $foundFile = false;
                foreach ($listResult['objects'] as $object) {
                    if ($object['key'] === $chunkUploadFile->getKey()) {
                        echo '✅ File found in FileService OSS list with size: ' . $object['size'] . " bytes\n";
                        echo '📋 List metadata: ' . json_encode($object, JSON_PRETTY_PRINT) . "\n";
                        $foundFile = true;
                        $uploadedSize = (int) $object['size'];
                        break;
                    }
                }

                if (! $foundFile) {
                    echo "❌ File not found in FileService OSS object list\n";
                }
            }
        }

        $this->assertEquals($originalSize, $uploadedSize, 'Uploaded file size should match original file size (from head or list)');

        // Clean up
        $this->cleanupUploadedFile($filesystem, $credentialPolicy, $chunkUploadFile->getKey());
    }

    /**
     * Test small file chunk upload via FileService OSS.
     */
    public function testSmallFileChunkUpload(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createOSSCredentialPolicy();

        // Create small test file (1MB)
        $smallFilePath = sys_get_temp_dir() . '/small_oss_chunk_test_' . uniqid() . '.txt';
        $this->createTestFile($smallFilePath, 1024 * 1024); // 1MB

        try {
            $chunkConfig = new ChunkUploadConfig(
                self::CHUNK_SIZE,      // chunkSize
                2 * 1024 * 1024,       // threshold (2MB - file is smaller, may use simple upload)
                2,                     // maxConcurrency
                3,                     // maxRetries
                1000                   // retryDelay
            );

            $testKey = $this->testPrefix . 'oss-small-chunk-test-' . uniqid() . '.txt';
            $chunkUploadFile = new ChunkUploadFile(
                $smallFilePath,
                '',
                $testKey,
                false,
                $chunkConfig
            );

            echo "\n📤 Uploading small file via FileService OSS chunks: " . round(filesize($smallFilePath) / 1024, 2) . "KB\n";

            $filesystem->uploadByChunks(
                $chunkUploadFile,
                $credentialPolicy,
                $this->getOptions($filesystem->getOptions())
            );

            $this->assertNotEmpty($chunkUploadFile->getKey(), 'Small file chunk upload should succeed');

            // Verify file metadata with OSS fallback
            $metadata = $filesystem->getHeadObjectByCredential(
                $credentialPolicy,
                $chunkUploadFile->getKey(),
                $this->getOptions($filesystem->getOptions())
            );
            $uploadedSize = (int) $metadata['content_length'];
            $originalSize = filesize($smallFilePath);

            // If head returns 0, try list as fallback
            if ($uploadedSize === 0) {
                $listResult = $filesystem->listObjectsByCredential(
                    $credentialPolicy,
                    $this->testPrefix,
                    $this->getOptions($filesystem->getOptions())
                );
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
     * Test chunk upload configuration options via FileService OSS.
     */
    public function testChunkUploadConfiguration(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createOSSCredentialPolicy();

        // Test with different chunk configuration
        $chunkConfig = new ChunkUploadConfig(
            self::CHUNK_SIZE,      // chunkSize (6MB)
            5 * 1024 * 1024,       // threshold (5MB)
            3,                     // maxConcurrency
            2,                     // maxRetries
            500                    // retryDelay
        );

        $testKey = $this->testPrefix . 'oss-config-test-' . uniqid() . '.dat';
        $chunkUploadFile = new ChunkUploadFile(
            $this->testFilePath,
            '',
            $testKey,
            false,
            $chunkConfig
        );

        echo "\n⚙️  Testing FileService OSS custom chunk configuration\n";

        $filesystem->uploadByChunks(
            $chunkUploadFile,
            $credentialPolicy,
            $this->getOptions($filesystem->getOptions())
        );

        $this->assertNotEmpty($chunkUploadFile->getKey());

        // Verify upload with OSS fallback
        $metadata = $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            $chunkUploadFile->getKey(),
            $this->getOptions($filesystem->getOptions())
        );
        $uploadedSize = (int) $metadata['content_length'];
        $originalSize = filesize($this->testFilePath);

        if ($uploadedSize === 0) {
            $listResult = $filesystem->listObjectsByCredential(
                $credentialPolicy,
                $this->testPrefix,
                $this->getOptions($filesystem->getOptions())
            );
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
     * Test chunk download API call via FileService OSS.
     */
    public function testChunkDownloadApiCall(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createOSSCredentialPolicy();

        // First, upload a file using createObjectByCredential for testing download
        $testKey = $this->testPrefix . 'oss-download-test-' . uniqid() . '.dat';
        $testContent = str_repeat('FILESERVICE OSS TEST DATA CHUNK DOWNLOAD ', 70000); // ~3MB

        echo "\n📤 Creating test file for FileService OSS download: " . round(strlen($testContent) / 1024 / 1024, 2) . "MB\n";

        $filesystem->createObjectByCredential(
            $credentialPolicy,
            $testKey,
            [
                'content' => $testContent,
                'content_type' => 'application/octet-stream',
            ],
            $this->getOptions($filesystem->getOptions())
        );

        // Create chunk download configuration
        $downloadConfig = new ChunkDownloadConfig();
        $downloadConfig->setChunkSize(1024 * 1024); // 1MB chunks
        $downloadConfig->setMaxConcurrency(3);
        $downloadConfig->setMaxRetries(3);
        $downloadConfig->setRetryDelay(1000);

        echo "📥 Starting FileService OSS chunk download\n";

        // Perform chunk download
        $startTime = microtime(true);
        $filesystem->downloadByChunks(
            $testKey,
            $this->downloadFilePath,
            $downloadConfig,
            $this->getOptions($filesystem->getOptions())
        );
        $endTime = microtime(true);

        $duration = round($endTime - $startTime, 2);
        $downloadedSize = filesize($this->downloadFilePath);
        $speed = round(($downloadedSize / 1024 / 1024) / $duration, 2);

        echo "✅ FileService OSS chunk download completed in {$duration}s at {$speed}MB/s\n";

        // Verify downloaded file
        $this->assertFileExists($this->downloadFilePath, 'Downloaded file should exist');

        $downloadedContent = file_get_contents($this->downloadFilePath);
        $this->assertEquals(strlen($testContent), strlen($downloadedContent), 'Downloaded file size should match');
        $this->assertEquals($testContent, $downloadedContent, 'Downloaded content should match original');

        echo '📊 FileService OSS download verification: ' . round($downloadedSize / 1024 / 1024, 2) . "MB downloaded successfully\n";

        // Clean up
        $this->cleanupUploadedFile($filesystem, $credentialPolicy, $testKey);
    }

    /**
     * Test chunk upload vs simple upload comparison via FileService OSS.
     */
    public function testChunkUploadVsSimpleUpload(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createOSSCredentialPolicy();

        // Create a test file
        $mediumFilePath = sys_get_temp_dir() . '/medium_oss_test_' . uniqid() . '.dat';
        $this->createTestFile($mediumFilePath, 8 * 1024 * 1024); // 8MB

        try {
            // Test 1: Simple upload via createObjectByCredential
            $simpleKey = $this->testPrefix . 'oss-simple-upload-' . uniqid() . '.dat';
            $fileContent = file_get_contents($mediumFilePath);

            echo "\n🔄 Comparing FileService OSS upload methods for " . round(strlen($fileContent) / 1024 / 1024, 2) . "MB file\n";

            $filesystem->createObjectByCredential(
                $credentialPolicy,
                $simpleKey,
                [
                    'content' => $fileContent,
                    'content_type' => 'application/octet-stream',
                ],
                $this->getOptions($filesystem->getOptions())
            );

            $simpleMetadata = $filesystem->getHeadObjectByCredential(
                $credentialPolicy,
                $simpleKey,
                $this->getOptions($filesystem->getOptions())
            );
            echo '✅ FileService OSS simple upload - content_length: ' . $simpleMetadata['content_length'] . " bytes\n";

            // Test 2: Chunk upload
            $chunkKey = $this->testPrefix . 'oss-chunk-upload-' . uniqid() . '.dat';
            $chunkConfig = new ChunkUploadConfig(self::CHUNK_SIZE, 1024 * 1024, 2, 3, 1000);
            $chunkUploadFile = new ChunkUploadFile($mediumFilePath, '', $chunkKey, false, $chunkConfig);

            $filesystem->uploadByChunks(
                $chunkUploadFile,
                $credentialPolicy,
                $this->getOptions($filesystem->getOptions())
            );

            $chunkMetadata = $filesystem->getHeadObjectByCredential(
                $credentialPolicy,
                $chunkUploadFile->getKey(),
                $this->getOptions($filesystem->getOptions())
            );
            $chunkSize = (int) $chunkMetadata['content_length'];

            // If head returns 0, try list as fallback (OSS issue)
            if ($chunkSize === 0) {
                $listResult = $filesystem->listObjectsByCredential(
                    $credentialPolicy,
                    $this->testPrefix,
                    $this->getOptions($filesystem->getOptions())
                );
                if (isset($listResult['objects'])) {
                    foreach ($listResult['objects'] as $object) {
                        if ($object['key'] === $chunkUploadFile->getKey()) {
                            $chunkSize = (int) $object['size'];
                            break;
                        }
                    }
                }
            }

            echo '✅ FileService OSS chunk upload - content_length: ' . $chunkSize . " bytes\n";

            // Compare results
            $this->assertEquals(
                $simpleMetadata['content_length'],
                $chunkSize,
                'Both FileService OSS upload methods should result in same file size'
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
     * Debug test to check FileService OSS getHeadObjectByCredential response.
     */
    public function testDebugGetHeadObject(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createOSSCredentialPolicy();

        // First create a test file using createObjectByCredential
        $testKey = $this->testPrefix . 'oss-debug-head-test-' . uniqid() . '.txt';
        $testContent = 'This is a FileService OSS test file for debugging head object response. Content length should be ' . strlen('This is a FileService OSS test file for debugging head object response. Content length should be ') . ' characters.';

        echo "\n🔍 Debug: Creating FileService OSS test file for head object test\n";
        echo '📄 Test content length: ' . strlen($testContent) . " bytes\n";

        // Create the file
        $filesystem->createObjectByCredential(
            $credentialPolicy,
            $testKey,
            [
                'content' => $testContent,
                'content_type' => 'text/plain',
            ],
            $this->getOptions($filesystem->getOptions())
        );

        echo "✅ FileService OSS test file created: {$testKey}\n";

        // Wait for consistency
        sleep(2);

        // Now try to get head object
        echo "🔍 Debug: Getting FileService OSS head object metadata...\n";
        $metadata = $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            $testKey,
            $this->getOptions($filesystem->getOptions())
        );

        echo "📋 FileService OSS raw metadata response:\n";
        var_dump($metadata);

        echo "\n📊 FileService OSS parsed metadata:\n";
        echo '- content_length: ' . ($metadata['content_length'] ?? 'NOT SET') . "\n";
        echo '- content_type: ' . ($metadata['content_type'] ?? 'NOT SET') . "\n";
        echo '- etag: ' . ($metadata['etag'] ?? 'NOT SET') . "\n";
        echo '- last_modified: ' . ($metadata['last_modified'] ?? 'NOT SET') . "\n";

        // Also try to list the object to compare
        echo "\n🔍 Debug: Listing FileService OSS objects to compare...\n";
        $listResult = $filesystem->listObjectsByCredential(
            $credentialPolicy,
            $this->testPrefix,
            $this->getOptions($filesystem->getOptions())
        );

        if (isset($listResult['objects'])) {
            foreach ($listResult['objects'] as $object) {
                if ($object['key'] === $testKey) {
                    echo "📁 Found in FileService OSS list:\n";
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
        return 'file_service_test';
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
            $data = str_repeat('O', $writeSize); // Use 'O' for OSS
            fwrite($handle, $data);
            $written += $writeSize;
        }

        fclose($handle);
    }

    /**
     * Create OSS-specific credential policy.
     */
    private function createOSSCredentialPolicy(): CredentialPolicy
    {
        return new CredentialPolicy([
            'sts' => true,
            'roleSessionName' => 'fileservice-oss-chunk-test',
        ]);
    }

    /**
     * Get options with global FileService configuration.
     */
    private function getOptions(array $globalOptions = []): array
    {
        return $globalOptions; // FileService requires token from global options
    }

    /**
     * Clean up uploaded file.
     * @param mixed $filesystem
     */
    private function cleanupUploadedFile($filesystem, CredentialPolicy $credentialPolicy, string $key): void
    {
        // DISABLED: Keep files for inspection - files will remain in FileService OSS bucket
        echo "🔍 FileService OSS file kept for inspection: {$key}\n";
        return;
        try {
            $filesystem->deleteObjectByCredential(
                $credentialPolicy,
                $key,
                $this->getOptions($filesystem->getOptions())
            );
            echo "🗑️  Cleaned up FileService OSS uploaded file: {$key}\n";
        } catch (Exception $e) {
            echo "⚠️  Failed to clean up FileService OSS uploaded file {$key}: " . $e->getMessage() . "\n";
        }
    }
}
