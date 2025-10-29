<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils\SimpleUpload;

use Aws\Credentials\Credentials;
use Aws\S3\MultipartUploader;
use Aws\S3\S3Client;
use Dtyq\CloudFile\Kernel\Exceptions\ChunkUploadException;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\AppendUploadFile;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload;
use Throwable;

class S3SimpleUpload extends SimpleUpload
{
    /**
     * @see https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html
     */
    public function uploadObject(array $credential, UploadFile $uploadFile): void
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }

        // Check required parameters
        if (! isset($credential['access_key_id']) || ! isset($credential['secret_access_key']) || ! isset($credential['bucket'])) {
            throw new CloudFileException('S3 upload credential is invalid');
        }

        $key = ($credential['dir'] ?? '') . $uploadFile->getKeyPath();

        try {
            $client = $this->createS3Client($credential);

            $params = [
                'Bucket' => $credential['bucket'],
                'Key' => $key,
                'Body' => fopen($uploadFile->getRealPath(), 'r'),
                'ContentType' => $uploadFile->getMimeType(),
            ];

            $client->putObject($params);

            $this->sdkContainer->getLogger()->info('s3_simple_upload_success', ['key' => $key, 'bucket' => $credential['bucket']]);
        } catch (Throwable $exception) {
            $errorMsg = $exception->getMessage();
            $this->sdkContainer->getLogger()->warning('s3_simple_upload_fail', ['key' => $key, 'bucket' => $credential['bucket'], 'error_msg' => $errorMsg]);
            throw $exception;
        }

        $uploadFile->setKey($key);
    }

    /**
     * S3 multipart upload implementation.
     *
     * @see https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload.html
     */
    public function uploadObjectByChunks(array $credential, ChunkUploadFile $chunkUploadFile): void
    {
        // Check if chunk upload is needed
        if (! $chunkUploadFile->shouldUseChunkUpload()) {
            // File is small, use simple upload
            $this->uploadObject($credential, $chunkUploadFile);
            return;
        }

        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }

        $client = $this->createS3Client($credential);

        $bucket = $credential['bucket'];
        $dir = $credential['dir'] ?? '';
        $key = $dir . $chunkUploadFile->getKeyPath();
        $filePath = $chunkUploadFile->getRealPath();

        try {
            $chunkUploadFile->setKey($key);

            $this->sdkContainer->getLogger()->info('s3_chunk_upload_start', [
                'key' => $key,
                'file_size' => $chunkUploadFile->getSize(),
                'chunk_size' => $chunkUploadFile->getChunkConfig()->getChunkSize(),
            ]);

            // Use S3Client's multipart uploader
            $uploader = new MultipartUploader($client, $filePath, [
                'bucket' => $bucket,
                'key' => $key,
                'part_size' => $chunkUploadFile->getChunkConfig()->getChunkSize(),
                'params' => [
                    'ContentType' => $chunkUploadFile->getMimeType() ?: 'application/octet-stream',
                ],
            ]);

            $uploader->upload();

            $this->sdkContainer->getLogger()->info('s3_chunk_upload_success', [
                'key' => $key,
                'file_size' => $chunkUploadFile->getSize(),
            ]);
        } catch (Throwable $exception) {
            $this->sdkContainer->getLogger()->error('s3_chunk_upload_failed', [
                'key' => $key,
                'bucket' => $bucket,
                'error' => $exception->getMessage(),
            ]);

            throw ChunkUploadException::createInitFailed(
                sprintf('S3 chunk upload error: %s', $exception->getMessage()),
                '',
                $exception
            );
        }
    }

    /**
     * S3 does not natively support append operations like OSS.
     * We implement it by downloading the object, appending content, and re-uploading.
     */
    public function appendUploadObject(array $credential, AppendUploadFile $appendUploadFile): void
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }

        $key = ($credential['dir'] ?? '') . $appendUploadFile->getKeyPath();

        if (! isset($credential['access_key_id']) || ! isset($credential['secret_access_key']) || ! isset($credential['bucket'])) {
            throw new CloudFileException('S3 upload credential is invalid');
        }

        try {
            $client = $this->createS3Client($credential);
            $bucket = $credential['bucket'];

            // Get existing content if position > 0
            $existingContent = '';
            if ($appendUploadFile->getPosition() > 0) {
                try {
                    $result = $client->getObject([
                        'Bucket' => $bucket,
                        'Key' => $key,
                    ]);
                    $existingContent = (string) $result['Body'];
                } catch (Throwable $e) {
                    // Object doesn't exist yet, that's ok
                }
            }

            // Read new content
            $newContent = file_get_contents($appendUploadFile->getRealPath());
            if ($newContent === false) {
                throw new CloudFileException('Failed to read file: ' . $appendUploadFile->getRealPath());
            }

            // Append and upload
            $combinedContent = $existingContent . $newContent;

            $client->putObject([
                'Bucket' => $bucket,
                'Key' => $key,
                'Body' => $combinedContent,
                'ContentType' => mime_content_type($appendUploadFile->getRealPath()) ?: 'application/octet-stream',
            ]);

            $appendUploadFile->setKey($key);
        } catch (Throwable $exception) {
            $errorMsg = $exception->getMessage();
            $this->sdkContainer->getLogger()->warning('s3_append_upload_fail', ['key' => $key, 'error_msg' => $errorMsg]);
            throw $exception;
        }
    }

    public function listObjectsByCredential(array $credential, string $prefix = '', array $options = []): array
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }

        $client = $this->createS3Client($credential);

        $params = [
            'Bucket' => $credential['bucket'],
        ];

        if (! empty($prefix)) {
            $params['Prefix'] = $prefix;
        }

        if (isset($options['marker'])) {
            $params['Marker'] = $options['marker'];
        }

        if (isset($options['max-keys'])) {
            $params['MaxKeys'] = $options['max-keys'];
        }

        $result = $client->listObjects($params);

        return $result['Contents'] ?? [];
    }

    public function deleteObjectByCredential(array $credential, string $objectKey, array $options = []): void
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }

        $client = $this->createS3Client($credential);

        $client->deleteObject([
            'Bucket' => $credential['bucket'],
            'Key' => $objectKey,
        ]);
    }

    public function copyObjectByCredential(array $credential, string $sourceKey, string $destinationKey, array $options = []): void
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }

        $client = $this->createS3Client($credential);

        $client->copyObject([
            'Bucket' => $credential['bucket'],
            'CopySource' => "{$credential['bucket']}/{$sourceKey}",
            'Key' => $destinationKey,
        ]);
    }

    public function getHeadObjectByCredential(array $credential, string $objectKey, array $options = []): array
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }

        $client = $this->createS3Client($credential);

        $result = $client->headObject([
            'Bucket' => $credential['bucket'],
            'Key' => $objectKey,
        ]);

        return $result->toArray();
    }

    public function createObjectByCredential(array $credential, string $objectKey, array $options = []): void
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }
        $client = $this->createS3Client($credential);

        $params = [
            'Bucket' => $credential['bucket'],
            'Key' => $objectKey,
            'Body' => $options['content'] ?? '',
            'ContentType' => $options['content_type'] ?? 'application/octet-stream',
        ];

        $client->putObject($params);
    }

    public function getPreSignedUrlByCredential(array $credential, string $objectKey, array $options = []): string
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }
        $client = $this->createS3Client($credential);

        // HTTP 方法转换为 S3 API 操作名
        // OSS/TOS 使用 HTTP 方法（GET, PUT），但 S3 需要 API 操作名（GetObject, PutObject）
        $httpMethod = strtoupper($options['method'] ?? 'GET');
        $methodMap = [
            'GET' => 'GetObject',
            'PUT' => 'PutObject',
            'POST' => 'PostObject',
            'DELETE' => 'DeleteObject',
            'HEAD' => 'HeadObject',
        ];
        $s3Operation = $methodMap[$httpMethod] ?? 'GetObject';

        $command = $client->getCommand($s3Operation, [
            'Bucket' => $credential['bucket'],
            'Key' => $objectKey,
        ]);

        $expires = $options['expires'] ?? 3600;
        $request = $client->createPresignedRequest($command, "+{$expires} seconds");

        return (string) $request->getUri();
    }

    public function deleteObjectsByCredential(array $credential, array $objectKeys, array $options = []): array
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }
        $client = $this->createS3Client($credential);

        $objects = array_map(fn ($key) => ['Key' => $key], $objectKeys);

        $result = $client->deleteObjects([
            'Bucket' => $credential['bucket'],
            'Delete' => [
                'Objects' => $objects,
            ],
        ]);

        return [
            'deleted' => $result['Deleted'] ?? [],
            'errors' => $result['Errors'] ?? [],
        ];
    }

    public function setHeadObjectByCredential(array $credential, string $objectKey, array $metadata, array $options = []): void
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }
        $client = $this->createS3Client($credential);

        // S3 requires copying the object to itself to update metadata
        $client->copyObject([
            'Bucket' => $credential['bucket'],
            'CopySource' => "{$credential['bucket']}/{$objectKey}",
            'Key' => $objectKey,
            'Metadata' => $metadata,
            'MetadataDirective' => 'REPLACE',
        ]);
    }

    private function createS3Client(array $credential): S3Client
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }

        $config = [
            'version' => $credential['version'] ?? 'latest',
            'region' => $credential['region'] ?? 'us-east-1',
            'use_path_style_endpoint' => $credential['use_path_style_endpoint'] ?? true,
        ];

        if (! empty($credential['endpoint'])) {
            $config['endpoint'] = $credential['endpoint'];
        }

        // Check if using temporary credentials (STS)
        if (isset($credential['session_token'])) {
            $config['credentials'] = new Credentials(
                $credential['access_key_id'],
                $credential['secret_access_key'],
                $credential['session_token']
            );
        } else {
            $config['credentials'] = [
                'key' => $credential['access_key_id'],
                'secret' => $credential['secret_access_key'],
            ];
        }

        return new S3Client($config);
    }
}
