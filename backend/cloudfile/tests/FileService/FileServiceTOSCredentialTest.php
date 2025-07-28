<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\FileService;

use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Tests\CloudFileBaseTest;
use Exception;

/**
 * FileService TOS Credential-based Object Management Test.
 *
 * This test covers the new credential-based methods via FileService TOS platform:
 * - listObjectsByCredential
 * - deleteObjectByCredential
 * - copyObjectByCredential
 * - getHeadObjectByCredential
 * - createObjectByCredential
 *
 * @internal
 * @coversNothing
 */
class FileServiceTOSCredentialTest extends CloudFileBaseTest
{
    private string $allowedDir = '';

    private string $testPrefix = '';

    private string $testFileKey = '';

    private string $testFolderKey = '';

    private string $testCopyKey = '';

    public function setUp(): void
    {
        parent::setUp();

        try {
            $filesystem = $this->getFilesystem();
            $credentialPolicy = $this->createTestCredentialPolicy();

            // Get credential to determine allowed dir
            $credential = $filesystem->getUploadTemporaryCredential($credentialPolicy, $this->getOptions($filesystem->getOptions()));
            $this->allowedDir = $credential['temporary_credential']['dir'] ?? '';

            // Set up test keys with allowed dir prefix
            $this->testPrefix = $this->allowedDir . 'fileservice-tos-credential/';
            $this->testFileKey = $this->testPrefix . 'test-file.txt';
            $this->testFolderKey = $this->testPrefix . 'test-folder/';
            $this->testCopyKey = $this->testPrefix . 'test-file-copy.txt';
        } catch (Exception $e) {
            // Will be handled by getFilesystem() in individual tests
        }
    }

    /**
     * Test creating an object by credential via FileService TOS.
     */
    public function testCreateObjectByCredential(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        // Test creating a file object
        $filesystem->createObjectByCredential(
            $credentialPolicy,
            $this->testFileKey,
            array_merge([
                'content' => 'Test file content for FileService TOS credential test',
                'content_type' => 'text/plain',
                'metadata' => [
                    'test-key' => 'fileservice-tos-test',
                    'created-by' => 'unit-test',
                ],
            ], $this->getOptions($filesystem->getOptions()))
        );

        $this->assertTrue(true, 'File object should be created successfully via FileService TOS');

        // Test creating a folder object
        $filesystem->createObjectByCredential(
            $credentialPolicy,
            $this->testFolderKey,
            array_merge([
                'metadata' => [
                    'folder-type' => 'fileservice-test-folder',
                ],
            ], $this->getOptions($filesystem->getOptions()))
        );

        $this->assertTrue(true, 'Folder object should be created successfully via FileService TOS');
    }

    /**
     * Test getting object metadata by credential via FileService TOS.
     *
     * @depends testCreateObjectByCredential
     */
    public function testGetHeadObjectByCredential(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        $metadata = $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            $this->testFileKey,
            $this->getOptions($filesystem->getOptions())
        );

        $this->assertIsArray($metadata, 'Metadata should be an array');
        $this->assertArrayHasKey('content_length', $metadata);
        $this->assertArrayHasKey('content_type', $metadata);
        $this->assertArrayHasKey('etag', $metadata);
        $this->assertArrayHasKey('last_modified', $metadata);
        $this->assertArrayHasKey('meta', $metadata);

        // Verify content length
        $expectedLength = strlen('Test file content for FileService TOS credential test');
        $this->assertEquals($expectedLength, $metadata['content_length']);

        // Verify content type
        $this->assertEquals('text/plain', $metadata['content_type']);
    }

    /**
     * Test getting metadata for non-existent object via FileService TOS.
     */
    public function testGetHeadObjectByCredentialNotFound(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        $this->expectException(CloudFileException::class);
        $this->expectExceptionMessage('Object not found');
        $this->expectExceptionCode(404);

        $nonExistentKey = $this->allowedDir . 'fileservice-tos-non-existent-object.txt';

        $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            $nonExistentKey,
            $this->getOptions($filesystem->getOptions())
        );
    }

    /**
     * Test listing objects by credential via FileService TOS.
     *
     * @depends testCreateObjectByCredential
     */
    public function testListObjectsByCredential(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        $result = $filesystem->listObjectsByCredential(
            $credentialPolicy,
            $this->testPrefix,
            $this->getOptions($filesystem->getOptions())
        );

        $this->assertIsArray($result, 'Result should be an array');
        $this->assertArrayHasKey('objects', $result);
        $this->assertArrayHasKey('name', $result);
        $this->assertArrayHasKey('prefix', $result);
        $this->assertArrayHasKey('max_keys', $result);

        // Verify we have at least the test objects
        $objectKeys = array_column($result['objects'], 'key');
        $this->assertContains($this->testFileKey, $objectKeys);
        $this->assertContains($this->testFolderKey, $objectKeys);

        // Test with pagination options
        $resultWithOptions = $filesystem->listObjectsByCredential(
            $credentialPolicy,
            $this->testPrefix,
            array_merge([
                'max-keys' => 10,
                'delimiter' => '/',
            ], $this->getOptions($filesystem->getOptions()))
        );

        $this->assertLessThanOrEqual(10, count($resultWithOptions['objects']));
    }

    /**
     * Test copying object by credential via FileService TOS.
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
            $this->testFileKey,
            $this->testCopyKey,
            $this->getOptions($filesystem->getOptions())
        );

        $this->assertTrue(true, 'Object should be copied successfully via FileService TOS');

        // Verify the copied object exists
        $metadata = $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            $this->testCopyKey,
            $this->getOptions($filesystem->getOptions())
        );

        $this->assertIsArray($metadata);
        $this->assertEquals('text/plain', $metadata['content_type']);

        // Test copy with options
        $copyKeyWithOptions = $this->testPrefix . 'test-file-copy-with-options.txt';
        $filesystem->copyObjectByCredential(
            $credentialPolicy,
            $this->testFileKey,
            $copyKeyWithOptions,
            array_merge([
                'metadata_directive' => 'REPLACE',
                'content_type' => 'application/octet-stream',
                'download_name' => 'fileservice-downloaded-file.txt',
                'metadata' => [
                    'copied-at' => date('Y-m-d H:i:s'),
                    'source' => $this->testFileKey,
                    'platform' => 'fileservice-tos',
                ],
            ], $this->getOptions($filesystem->getOptions()))
        );

        // Verify the copied object with new metadata
        $newMetadata = $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            $copyKeyWithOptions,
            $this->getOptions($filesystem->getOptions())
        );

        $this->assertEquals('application/octet-stream', $newMetadata['content_type']);
        $this->assertStringContainsString('fileservice-downloaded-file.txt', $newMetadata['content_disposition']);

        // Clean up the additional copy - DISABLED: Keep files for inspection
        // $filesystem->deleteObjectByCredential(
        //     $credentialPolicy,
        //     $copyKeyWithOptions,
        //     $this->getOptions($filesystem->getOptions())
        // );
        echo "🔍 FileService TOS file kept for inspection: {$copyKeyWithOptions}\n";
    }

    /**
     * Test deleting object by credential via FileService TOS.
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
            $this->testCopyKey,
            $this->getOptions($filesystem->getOptions())
        );

        $this->assertTrue(true, 'Object should be deleted successfully via FileService TOS');

        // Verify the object no longer exists
        $this->expectException(CloudFileException::class);

        $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            $this->testCopyKey,
            $this->getOptions($filesystem->getOptions())
        );
    }

    /**
     * Test various edge cases and error conditions via FileService TOS.
     */
    public function testEdgeCases(): void
    {
        $filesystem = $this->getFilesystem();
        $credentialPolicy = $this->createTestCredentialPolicy();

        // Test creating object with empty content
        $emptyFileKey = $this->testPrefix . 'empty-file.txt';
        $filesystem->createObjectByCredential(
            $credentialPolicy,
            $emptyFileKey,
            array_merge(['content' => ''], $this->getOptions($filesystem->getOptions()))
        );

        $metadata = $filesystem->getHeadObjectByCredential(
            $credentialPolicy,
            $emptyFileKey,
            $this->getOptions($filesystem->getOptions())
        );

        $this->assertEquals(0, $metadata['content_length']);

        // Test listing with allowed dir as prefix
        $result = $filesystem->listObjectsByCredential(
            $credentialPolicy,
            $this->allowedDir,
            $this->getOptions($filesystem->getOptions())
        );

        $this->assertIsArray($result);
        $this->assertArrayHasKey('objects', $result);

        // Clean up - DISABLED: Keep files for inspection
        // $filesystem->deleteObjectByCredential(
        //     $credentialPolicy,
        //     $emptyFileKey,
        //     $this->getOptions($filesystem->getOptions())
        // );
        echo "🔍 FileService TOS empty file kept for inspection: {$emptyFileKey}\n";
    }

    protected function getStorageName(): string
    {
        return 'file_service_tos_test';
    }

    /**
     * Create test credential policy for FileService TOS.
     */
    private function createTestCredentialPolicy(): CredentialPolicy
    {
        return new CredentialPolicy([
            'sts' => true,
            'roleSessionName' => 'fileservice-tos-credential-test',
        ]);
    }

    private function getOptions(array $options = []): array
    {
        return array_merge($options, [
            'cache' => false,
        ]);
    }
}
