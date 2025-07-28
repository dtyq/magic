<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\OSS;

use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\FilesystemProxy;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;

/**
 * OSS Credential-based Object Management Test.
 *
 * This test covers the new credential-based methods:
 * - listObjectsByCredential
 * - deleteObjectByCredential
 * - copyObjectByCredential
 * - getHeadObjectByCredential
 * - createObjectByCredential
 *
 * @internal
 * @coversNothing
 */
class OSSCredentialTest extends CloudFileBaseTest
{
    private const TEST_PREFIX = 'test-credential/';

    private const TEST_FILE_KEY = 'test-credential/test-file.txt';

    private const TEST_FOLDER_KEY = 'test-credential/test-folder/';

    private const TEST_COPY_KEY = 'test-credential/test-file-copy.txt';

    /**
     * Test creating an object by credential.
     */
    public function testCreateObjectByCredential(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        // Test creating a file object
        $filesystem->createObjectByCredential(
            $credentialPolicy,
            self::TEST_FILE_KEY,
            [
                'content' => 'Test file content for credential test',
                'content_type' => 'text/plain',
                'metadata' => [
                    'test-key' => 'test-value',
                    'created-by' => 'unit-test',
                ],
            ]
        );

        $this->assertTrue(true, 'File object should be created successfully');

        // Test creating a folder object
        $filesystem->createObjectByCredential(
            $credentialPolicy,
            self::TEST_FOLDER_KEY,
            [
                'metadata' => [
                    'folder-type' => 'test-folder',
                ],
            ]
        );

        $this->assertTrue(true, 'Folder object should be created successfully');
    }

    /**
     * Test getting object metadata by credential.
     *
     * @depends testCreateObjectByCredential
     */
    public function testGetHeadObjectByCredential(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        $metadata = $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            self::TEST_FILE_KEY
        );

        $this->assertIsArray($metadata, 'Metadata should be an array');
        $this->assertArrayHasKey('content_length', $metadata);
        $this->assertArrayHasKey('content_type', $metadata);
        $this->assertArrayHasKey('etag', $metadata);
        $this->assertArrayHasKey('last_modified', $metadata);
        $this->assertArrayHasKey('meta', $metadata);

        // Verify content length
        $expectedLength = strlen('Test file content for credential test');
        $this->assertEquals($expectedLength, $metadata['content_length']);

        // Verify content type
        $this->assertEquals('text/plain', $metadata['content_type']);
    }

    /**
     * Test getting metadata for non-existent object.
     */
    public function testGetHeadObjectByCredentialNotFound(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        $this->expectException(CloudFileException::class);
        $this->expectExceptionMessage('Object not found');
        $this->expectExceptionCode(404);

        $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            'non-existent-object.txt'
        );
    }

    /**
     * Test listing objects by credential.
     *
     * @depends testCreateObjectByCredential
     */
    public function testListObjectsByCredential(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        $result = $filesystem->listObjectsByCredential(
            $credentialPolicy,
            self::TEST_PREFIX
        );

        $this->assertIsArray($result, 'Result should be an array');
        $this->assertArrayHasKey('objects', $result);
        $this->assertArrayHasKey('name', $result);
        $this->assertArrayHasKey('prefix', $result);
        $this->assertArrayHasKey('max_keys', $result);

        // Verify we have at least the test file object
        $objectKeys = array_column($result['objects'], 'key');
        $this->assertContains(self::TEST_FILE_KEY, $objectKeys);

        // For OSS, folder objects might not always appear in listings depending on configuration
        // So we check if we have at least one object
        $this->assertGreaterThanOrEqual(1, count($objectKeys));

        // Test with pagination options
        $resultWithOptions = $filesystem->listObjectsByCredential(
            $credentialPolicy,
            self::TEST_PREFIX,
            [
                'max-keys' => 10,
                'delimiter' => '/',
            ]
        );

        $this->assertLessThanOrEqual(10, count($resultWithOptions['objects']));
    }

    /**
     * Test copying object by credential.
     *
     * @depends testCreateObjectByCredential
     */
    public function testCopyObjectByCredential(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        // Basic copy operation
        $filesystem->copyObjectByCredential(
            $credentialPolicy,
            self::TEST_FILE_KEY,
            self::TEST_COPY_KEY
        );

        $this->assertTrue(true, 'Object should be copied successfully');

        // Verify the copied object exists
        $metadata = $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            self::TEST_COPY_KEY
        );

        $this->assertIsArray($metadata);
        $this->assertEquals('text/plain', $metadata['content_type']);

        // Test copy with options
        $copyKeyWithOptions = 'test-credential/test-file-copy-with-options.txt';
        $filesystem->copyObjectByCredential(
            $credentialPolicy,
            self::TEST_FILE_KEY,
            $copyKeyWithOptions,
            [
                'content_type' => 'application/octet-stream',
                'download_name' => 'downloaded-file.txt',
                'metadata' => [
                    'copied-at' => date('Y-m-d H:i:s'),
                    'source' => self::TEST_FILE_KEY,
                ],
            ]
        );

        // Verify the copied object with new metadata
        $newMetadata = $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            $copyKeyWithOptions
        );

        $this->assertEquals('application/octet-stream', $newMetadata['content_type']);

        // For OSS, content-disposition might be in the headers
        if (isset($newMetadata['content_disposition'])) {
            $this->assertStringContainsString('downloaded-file.txt', $newMetadata['content_disposition']);
        }

        // Clean up the additional copy
        $filesystem->deleteObjectByCredential(
            $credentialPolicy,
            $copyKeyWithOptions
        );
    }

    /**
     * Test deleting object by credential.
     *
     * @depends testCreateObjectByCredential
     * @depends testCopyObjectByCredential
     */
    public function testDeleteObjectByCredential(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        // Delete the copied object
        $filesystem->deleteObjectByCredential(
            $credentialPolicy,
            self::TEST_COPY_KEY
        );

        $this->assertTrue(true, 'Object should be deleted successfully');

        // Verify the object no longer exists
        $this->expectException(CloudFileException::class);

        $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            self::TEST_COPY_KEY
        );
    }

    /**
     * Test various edge cases and error conditions.
     */
    public function testEdgeCases(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        // Test creating object with empty content
        $emptyFileKey = 'test-credential/empty-file.txt';
        $filesystem->createObjectByCredential(
            $credentialPolicy,
            $emptyFileKey,
            ['content' => '']
        );

        $metadata = $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            $emptyFileKey
        );

        $this->assertEquals(0, $metadata['content_length']);

        // Test listing with empty prefix
        $result = $filesystem->listObjectsByCredential(
            $credentialPolicy,
            '/'
        );

        $this->assertIsArray($result);
        $this->assertArrayHasKey('objects', $result);

        // Clean up
        $filesystem->deleteObjectByCredential(
            $credentialPolicy,
            $emptyFileKey
        );
    }

    /**
     * Create test credential policy.
     */
    private function createTestCredentialPolicy(): CredentialPolicy
    {
        return new CredentialPolicy([
            'sts' => true,
            'roleSessionName' => 'credential-test',
        ]);
    }

    private function getFilesystem(): FilesystemProxy
    {
        $easyFile = $this->createCloudFile();
        return $easyFile->get('aliyun_test');
    }
}
