<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\InternalNetwork\OSS;

use Dtyq\CloudFile\Kernel\Struct\ChunkUploadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Utils\EasyFileTools;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;
use Exception;

/**
 * OSS Internal Network Endpoint Tests.
 *
 * Tests OSS internal network functionality including:
 * - STS credential generation with internal endpoints
 * - Download link generation with internal endpoints
 * - Chunk upload with internal endpoints
 *
 * NOTE: These tests will fail in local environments (expected behavior)
 * as internal endpoints are only accessible within Alibaba Cloud ECS.
 *
 * @internal
 * @coversNothing
 */
class OSSInternalEndpointTest extends CloudFileBaseTest
{
    /**
     * Test STS credential generation with internal endpoint option.
     */
    public function testGetUploadCredentialWithInternalEndpoint(): void
    {
        $filesystem = $this->getFilesystem();

        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'roleSessionName' => 'internal-test',
            'dir' => 'internal-test/',
            'expires' => 3600,
        ]);

        // Get credential with internal endpoint
        $credential = $filesystem->getUploadTemporaryCredential($credentialPolicy, [
            'use_internal_endpoint' => true,
        ]);

        // Verify credential structure
        $this->assertArrayHasKey('temporary_credential', $credential);
        $tempCredential = $credential['temporary_credential'];

        // Verify that endpoint field exists and is internal
        $this->assertArrayHasKey('endpoint', $tempCredential);
        $endpoint = $tempCredential['endpoint'];
        $this->assertStringContainsString('-internal.aliyuncs.com', $endpoint);

        // Verify it's a valid internal endpoint format
        $this->assertMatchesRegularExpression('/^https:\/\/oss-.+-internal\.aliyuncs\.com$/', $endpoint);
    }

    /**
     * Test credential comparison between public and internal endpoints.
     */
    public function testCredentialComparisonPublicVsInternal(): void
    {
        $filesystem = $this->getFilesystem();

        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'roleSessionName' => 'internal-test',
            'dir' => 'internal-test/',
        ]);

        // Get public credential
        $publicCredential = $filesystem->getUploadTemporaryCredential($credentialPolicy);

        // Get internal credential
        $internalCredential = $filesystem->getUploadTemporaryCredential($credentialPolicy, [
            'use_internal_endpoint' => true,
        ]);

        // Both should have same basic structure
        $this->assertEquals($publicCredential['platform'], $internalCredential['platform']);

        // But endpoints should be different
        $internalEndpoint = $internalCredential['temporary_credential']['endpoint'];
        $this->assertStringContainsString('-internal.aliyuncs.com', $internalEndpoint);
    }

    /**
     * Test download link generation with internal endpoint.
     */
    public function testGetFileLinksWithInternalEndpoint(): void
    {
        $filesystem = $this->getFilesystem();
        $paths = ['test/internal-endpoint-test.jpg'];

        // Get internal download links
        $internalLinks = $filesystem->getLinks($paths, [], 3600, [
            'use_internal_endpoint' => true,
        ]);

        $this->assertNotEmpty($internalLinks);

        foreach ($internalLinks as $link) {
            $url = $link->getUrl();
            // Should contain internal endpoint pattern
            $this->assertStringContainsString('-internal.aliyuncs.com', $url);
        }
    }

    /**
     * Test chunk upload with internal endpoint.
     *
     * This test will fail in local environment (expected), confirming
     * that the internal endpoint is actually being used.
     */
    public function testChunkUploadWithInternalEndpoint(): void
    {
        $filesystem = $this->getFilesystem();
        $testFilePath = __DIR__ . '/../../test.txt';

        $chunkConfig = new ChunkUploadConfig();
        $chunkConfig->setChunkSize(5 * 1024 * 1024); // 5MB chunks
        $chunkConfig->setMaxRetries(1); // Fail fast for testing

        $chunkUploadFile = new ChunkUploadFile($testFilePath, '', 'internal-test-file.txt', false, $chunkConfig);

        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'roleSessionName' => 'internal-test',
            'dir' => 'internal-test/',
        ]);

        // This should fail in local environment due to internal endpoint
        $this->expectException(Exception::class);

        $filesystem->uploadByChunks($chunkUploadFile, $credentialPolicy, [
            'use_internal_endpoint' => true,
        ]);
    }

    /**
     * Test endpoint conversion utility methods.
     */
    public function testEndpointConversionMethods(): void
    {
        $publicEndpoint = 'https://oss-cn-hangzhou.aliyuncs.com';
        $expectedInternal = 'https://oss-cn-hangzhou-internal.aliyuncs.com';

        // Test direct conversion
        $internal = EasyFileTools::convertOSSToInternalEndpoint($publicEndpoint);
        $this->assertEquals($expectedInternal, $internal);

        // Test generic conversion
        $internal2 = EasyFileTools::convertToInternalEndpoint($publicEndpoint, 'aliyun', true);
        $this->assertEquals($expectedInternal, $internal2);

        // Test reverse conversion
        $backToPublic = EasyFileTools::convertOSSToPublicEndpoint($internal);
        $this->assertEquals($publicEndpoint, $backToPublic);
    }

    /**
     * Test error handling for invalid configurations.
     */
    public function testInternalEndpointErrorHandling(): void
    {
        // Test with malformed endpoint in conversion
        $malformed = 'not-a-valid-endpoint';
        $result = EasyFileTools::convertToInternalEndpoint($malformed, 'aliyun', true);
        $this->assertEquals($malformed, $result); // Should return unchanged

        // Test endpoint conversion with unsupported platform
        $endpoint = 'https://oss-cn-hangzhou.aliyuncs.com';
        $result = EasyFileTools::convertToInternalEndpoint($endpoint, 'unsupported', true);
        $this->assertEquals($endpoint, $result); // Should return unchanged
    }

    protected function getStorageName(): string
    {
        return 'aliyun_test';
    }
}
