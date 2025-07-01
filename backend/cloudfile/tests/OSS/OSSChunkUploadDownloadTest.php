<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\OSS;

use Dtyq\CloudFile\Kernel\Driver\OSS\OSSExpand;
use Dtyq\CloudFile\Kernel\Struct\ChunkDownloadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload\AliyunSimpleUpload;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;
use Dtyq\SdkBase\SdkBase;
use Psr\Log\LoggerInterface;

/**
 * OSS Chunk Upload and Download Integration Test
 * 
 * This test covers:
 * - OSS chunk upload using AliyunSimpleUpload
 * - OSS chunk download using OSSExpand
 * - File integrity verification (size + MD5 hash)
 * 
 * @internal
 * @coversNothing
 */
class OSSChunkUploadDownloadTest extends CloudFileBaseTest
{
    private const TEST_FILE_SIZE = 15 * 1024 * 1024; // 15MB test file
    private const CHUNK_SIZE = 5 * 1024 * 1024;      // 5MB chunk size
    private const MAX_CONCURRENCY = 2;               // 2 concurrent uploads/downloads
    
    private string $testFilePath;
    private string $downloadFilePath;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        // Create test file
        $this->testFilePath = sys_get_temp_dir() . '/oss_chunk_test_' . uniqid() . '.dat';
        $this->downloadFilePath = sys_get_temp_dir() . '/oss_chunk_download_' . uniqid() . '.dat';
        
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
     * Test complete chunk upload and download workflow
     */
    public function testChunkUploadAndDownloadIntegration(): void
    {
        // Skip test if STS credentials are not configured
        if (!$this->hasStsCredentials()) {
            $this->markTestSkipped('STS credentials not configured. Set OSS_STS_* environment variables to run this test.');
        }
        
        $originalFileSize = filesize($this->testFilePath);
        $originalMd5 = md5_file($this->testFilePath);
        
        // Phase 1: Chunk Upload
        $uploadedKey = $this->performChunkUpload();
        $this->assertNotEmpty($uploadedKey, 'Upload should return a valid key');
        
        // Phase 2: Chunk Download
        $this->performChunkDownload($uploadedKey);
        $this->assertFileExists($this->downloadFilePath, 'Downloaded file should exist');
        
        // Phase 3: File Integrity Verification
        $this->verifyFileIntegrity($originalFileSize, $originalMd5);
        
        // Clean up uploaded file
        $this->cleanupUploadedFile($uploadedKey);
    }
    
    /**
     * Test chunk upload with small file (should use simple upload)
     */
    public function testSmallFileUpload(): void
    {
        if (!$this->hasStsCredentials()) {
            $this->markTestSkipped('STS credentials not configured.');
        }
        
        // Create small test file (1KB)
        $smallFilePath = sys_get_temp_dir() . '/small_test_' . uniqid() . '.txt';
        file_put_contents($smallFilePath, str_repeat('test data ', 100));
        
        try {
            $credential = $this->createTestCredential();
            $aliyunUpload = $this->createAliyunSimpleUpload();
            
            $uploadConfig = new ChunkUploadConfig(
                self::CHUNK_SIZE,
                10 * 1024 * 1024, // 10MB threshold - file is smaller, should use simple upload
                self::MAX_CONCURRENCY,
                3,
                1000
            );
            
            $chunkFile = new ChunkUploadFile(
                $smallFilePath,
                '',
                'test-small-' . basename($smallFilePath),
                false,
                $uploadConfig
            );
            
            $aliyunUpload->uploadObjectByChunks($credential, $chunkFile);
            
            $this->assertNotEmpty($chunkFile->getKey(), 'Small file upload should succeed');
            
            // Clean up
            $this->cleanupUploadedFile($chunkFile->getKey());
            
        } finally {
            if (file_exists($smallFilePath)) {
                unlink($smallFilePath);
            }
        }
    }
    
    /**
     * Perform chunk upload
     */
    private function performChunkUpload(): string
    {
        $credential = $this->createTestCredential();
        $aliyunUpload = $this->createAliyunSimpleUpload();
        
        $uploadConfig = new ChunkUploadConfig(
            self::CHUNK_SIZE,
            10 * 1024 * 1024, // 10MB threshold
            self::MAX_CONCURRENCY,
            3, // max retries
            1000 // retry delay ms
        );
        
        $chunkFile = new ChunkUploadFile(
            $this->testFilePath,
            '',
            'integration-test-' . basename($this->testFilePath),
            false,
            $uploadConfig
        );
        
        $startTime = microtime(true);
        $aliyunUpload->uploadObjectByChunks($credential, $chunkFile);
        $endTime = microtime(true);
        
        $duration = round($endTime - $startTime, 2);
        $speed = round((filesize($this->testFilePath) / 1024 / 1024) / $duration, 2);
        
        echo "\n✅ Chunk upload completed in {$duration}s at {$speed}MB/s\n";
        
        return $chunkFile->getKey();
    }
    
    /**
     * Perform chunk download
     */
    private function performChunkDownload(string $uploadedKey): void
    {
        $downloadConfig = $this->createDownloadConfig();
        $ossExpand = new OSSExpand($downloadConfig);
        
        $chunkDownloadConfig = new ChunkDownloadConfig();
        $chunkDownloadConfig->setChunkSize(self::CHUNK_SIZE);
        $chunkDownloadConfig->setMaxConcurrency(3);
        $chunkDownloadConfig->setMaxRetries(3);
        $chunkDownloadConfig->setRetryDelay(1000);
        
        $startTime = microtime(true);
        $ossExpand->downloadByChunks($uploadedKey, $this->downloadFilePath, $chunkDownloadConfig);
        $endTime = microtime(true);
        
        $duration = round($endTime - $startTime, 2);
        $speed = round((filesize($this->downloadFilePath) / 1024 / 1024) / $duration, 2);
        
        echo "✅ Chunk download completed in {$duration}s at {$speed}MB/s\n";
    }
    
    /**
     * Verify file integrity
     */
    private function verifyFileIntegrity(int $originalSize, string $originalMd5): void
    {
        $downloadedSize = filesize($this->downloadFilePath);
        $downloadedMd5 = md5_file($this->downloadFilePath);
        
        $this->assertEquals($originalSize, $downloadedSize, 'File sizes should match');
        $this->assertEquals($originalMd5, $downloadedMd5, 'File MD5 hashes should match');
        
        echo "✅ File integrity verified: " . round($originalSize / 1024 / 1024, 2) . "MB, MD5: {$originalMd5}\n";
    }
    
    /**
     * Create test file with specified size
     */
    private function createTestFile(string $filePath, int $size): void
    {
        $handle = fopen($filePath, 'wb');
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
     * Create test credential from environment variables
     */
    private function createTestCredential(): array
    {
        return [
            'platform' => 'aliyun',
            'temporary_credential' => [
                'region' => $_ENV['OSS_REGION'] ?? 'oss-cn-hangzhou',
                'access_key_id' => $_ENV['OSS_STS_ACCESS_KEY_ID'] ?? '',
                'access_key_secret' => $_ENV['OSS_STS_ACCESS_KEY_SECRET'] ?? '',
                'sts_token' => $_ENV['OSS_STS_TOKEN'] ?? '',
                'bucket' => $_ENV['OSS_BUCKET'] ?? 'test-bucket',
                'dir' => $_ENV['OSS_DIR'] ?? 'test/',
                'expires' => 3600,
                'callback' => '',
            ],
            'expires' => time() + 3600,
        ];
    }
    
    /**
     * Create download configuration from environment variables
     */
    private function createDownloadConfig(): array
    {
        $region = $_ENV['OSS_REGION'] ?? 'oss-cn-hangzhou';
        $actualRegion = str_replace('oss-', '', $region);
        
        return [
            'accessId' => $_ENV['OSS_STS_ACCESS_KEY_ID'] ?? '',
            'accessSecret' => $_ENV['OSS_STS_ACCESS_KEY_SECRET'] ?? '',
            'securityToken' => $_ENV['OSS_STS_TOKEN'] ?? '',
            'endpoint' => $_ENV['OSS_ENDPOINT'] ?? "https://oss-{$actualRegion}.aliyuncs.com",
            'bucket' => $_ENV['OSS_BUCKET'] ?? 'test-bucket',
            'timeout' => 60,
            'connectTimeout' => 10,
            'region' => $actualRegion,
        ];
    }
    
    /**
     * Create AliyunSimpleUpload instance
     */
    private function createAliyunSimpleUpload(): AliyunSimpleUpload
    {
        $container = new class implements \Psr\Container\ContainerInterface {
            public function get(string $id) {
                if ($id === LoggerInterface::class) {
                    return new class implements LoggerInterface {
                        public function emergency($message, array $context = []): void { $this->log('EMERGENCY', $message, $context); }
                        public function alert($message, array $context = []): void { $this->log('ALERT', $message, $context); }
                        public function critical($message, array $context = []): void { $this->log('CRITICAL', $message, $context); }
                        public function error($message, array $context = []): void { $this->log('ERROR', $message, $context); }
                        public function warning($message, array $context = []): void { $this->log('WARNING', $message, $context); }
                        public function notice($message, array $context = []): void { $this->log('NOTICE', $message, $context); }
                        public function info($message, array $context = []): void { $this->log('INFO', $message, $context); }
                        public function debug($message, array $context = []): void { $this->log('DEBUG', $message, $context); }
                        
                        public function log($level, $message, array $context = []): void
                        {
                            // Silent logger for tests
                        }
                    };
                }
                throw new \Exception("Service {$id} not found");
            }
            public function has(string $id): bool {
                return $id === LoggerInterface::class;
            }
        };
        
        $sdkBase = new SdkBase($container, [
            'sdk_name' => 'oss_chunk_test',
            'exception_class' => \Exception::class,
        ]);
        
        return new AliyunSimpleUpload($sdkBase);
    }
    
    /**
     * Check if STS credentials are configured
     */
    private function hasStsCredentials(): bool
    {
        return !empty($_ENV['OSS_STS_ACCESS_KEY_ID']) 
            && !empty($_ENV['OSS_STS_ACCESS_KEY_SECRET']) 
            && !empty($_ENV['OSS_STS_TOKEN'])
            && !empty($_ENV['OSS_BUCKET']);
    }
    
    /**
     * Clean up uploaded file
     */
    private function cleanupUploadedFile(string $key): void
    {
        try {
            $downloadConfig = $this->createDownloadConfig();
            $ossExpand = new OSSExpand($downloadConfig);
            $ossExpand->destroy([$key]);
            echo "🗑️  Cleaned up uploaded file: {$key}\n";
        } catch (\Exception $e) {
            echo "⚠️  Failed to clean up uploaded file {$key}: " . $e->getMessage() . "\n";
        }
    }
} 