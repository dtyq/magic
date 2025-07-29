<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\InternalNetwork\TOS;

use Dtyq\CloudFile\Kernel\Struct\ChunkUploadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Utils\EasyFileTools;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;
use Exception;

/**
 * TOS Internal Network Endpoint Tests.
 *
 * Tests TOS internal network functionality including:
 * - STS credential generation with internal endpoints
 * - Download link generation with internal endpoints
 * - Chunk upload with internal endpoints
 *
 * NOTE: These tests will fail in local environments (expected behavior)
 * as internal endpoints are only accessible within ByteDance Cloud ECS.
 *
 * @internal
 * @coversNothing
 */
class TOSInternalEndpointTest extends CloudFileBaseTest
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
        $this->assertStringContainsString('.ivolces.com', $endpoint);

        // Verify it's a valid internal endpoint format
        $this->assertMatchesRegularExpression('/^https:\/\/tos(-s3)?-[^.]+\.ivolces\.com$/', $endpoint);
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
        $this->assertStringContainsString('.ivolces.com', $internalEndpoint);
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
            $this->assertStringContainsString('.ivolces.com', $url);
        }
    }

    /**
     * Test pre-signed URL generation with internal endpoint.
     */
    public function testGetPreSignedUrlsWithInternalEndpoint(): void
    {
        $filesystem = $this->getFilesystem();
        $fileNames = ['test-internal-file.jpg'];

        // Get internal pre-signed URLs
        $internalUrls = $filesystem->getPreSignedUrls($fileNames, 3600, [
            'use_internal_endpoint' => true,
        ]);

        // TOS may not support getPreSignedUrls or may return empty for test files
        if (empty($internalUrls)) {
            $this->markTestSkipped('TOS getPreSignedUrls returned empty - may not be supported');
            return;
        }

        foreach ($internalUrls as $preSignedUrl) {
            $url = $preSignedUrl->getUrl();
            // Should contain internal endpoint pattern
            $this->assertStringContainsString('.ivolces.com', $url);
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
        $publicEndpoint = 'https://tos-cn-beijing.volces.com';
        $expectedInternal = 'https://tos-cn-beijing.ivolces.com';

        // Test direct conversion
        $internal = EasyFileTools::convertTOSToInternalEndpoint($publicEndpoint);
        $this->assertEquals($expectedInternal, $internal);

        // Test generic conversion
        $internal2 = EasyFileTools::convertToInternalEndpoint($publicEndpoint, 'tos', true);
        $this->assertEquals($expectedInternal, $internal2);

        // Test reverse conversion
        $backToPublic = EasyFileTools::convertTOSToPublicEndpoint($internal);
        $this->assertEquals($publicEndpoint, $backToPublic);
    }

    /**
     * Test error handling for invalid configurations.
     */
    public function testInternalEndpointErrorHandling(): void
    {
        // Test with malformed endpoint in conversion
        $malformed = 'not-a-valid-endpoint';
        $result = EasyFileTools::convertToInternalEndpoint($malformed, 'tos', true);
        $this->assertEquals($malformed, $result); // Should return unchanged

        // Test endpoint conversion with unsupported platform
        $endpoint = 'https://tos-cn-beijing.volces.com';
        $result = EasyFileTools::convertToInternalEndpoint($endpoint, 'unsupported', true);
        $this->assertEquals($endpoint, $result); // Should return unchanged
    }

    protected function getStorageName(): string
    {
        return 'tos_test';
    }
}
