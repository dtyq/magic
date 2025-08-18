<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils\SimpleUpload;

use Dtyq\CloudFile\Kernel\Exceptions\ChunkUploadException;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\AppendUploadFile;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\CurlHelper;
use Dtyq\CloudFile\Kernel\Utils\MimeTypes;
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload;
use Throwable;
use Tos\Exception\TosClientException;
use Tos\Exception\TosServerException;
use Tos\Model\AbortMultipartUploadInput;
use Tos\Model\CompleteMultipartUploadInput;
use Tos\Model\CopyObjectInput;
use Tos\Model\CreateMultipartUploadInput;
use Tos\Model\DeleteMultiObjectsInput;
use Tos\Model\DeleteObjectInput;
use Tos\Model\HeadObjectInput;
use Tos\Model\ListObjectsInput;
use Tos\Model\ObjectTobeDeleted;
use Tos\Model\PreSignedURLInput;
use Tos\Model\PutObjectInput;
use Tos\Model\SetObjectMetaInput;
use Tos\Model\UploadedPart;
use Tos\Model\UploadPartInput;
use Tos\TosClient;

class TosSimpleUpload extends SimpleUpload
{
    public function uploadObject(array $credential, UploadFile $uploadFile): void
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }
        if (! isset($credential['dir']) || ! isset($credential['policy']) || ! isset($credential['x-tos-server-side-encryption']) || ! isset($credential['x-tos-algorithm']) || ! isset($credential['x-tos-date']) || ! isset($credential['x-tos-credential']) || ! isset($credential['x-tos-signature'])) {
            throw new CloudFileException('Tos upload credential is invalid');
        }

        $key = $credential['dir'] . $uploadFile->getKeyPath();
        $body = [
            'key' => $key,
        ];
        if (! empty($credential['content_type'])) {
            $body['Content-Type'] = $credential['content_type'];
        }
        $body['x-tos-server-side-encryption'] = $credential['x-tos-server-side-encryption'];
        $body['x-tos-algorithm'] = $credential['x-tos-algorithm'];
        $body['x-tos-date'] = $credential['x-tos-date'];
        $body['x-tos-credential'] = $credential['x-tos-credential'];
        $body['policy'] = $credential['policy'];
        $body['x-tos-signature'] = $credential['x-tos-signature'];
        $body['file'] = curl_file_create($uploadFile->getRealPath(), $uploadFile->getMimeType(), $uploadFile->getName());

        try {
            CurlHelper::sendRequest($credential['host'], $body, [], 204);
        } catch (Throwable $exception) {
            $errorMsg = $exception->getMessage();
            throw $exception;
        } finally {
            if (isset($errorMsg)) {
                $this->sdkContainer->getLogger()->warning('simple_upload_fail', ['key' => $key, 'host' => $credential['host'], 'error_msg' => $errorMsg]);
            } else {
                $this->sdkContainer->getLogger()->info('simple_upload_success', ['key' => $key, 'host' => $credential['host']]);
            }
        }
        $uploadFile->setKey($key);
    }

    public function appendUploadObject(array $credential, AppendUploadFile $appendUploadFile): void
    {
        $object = $credential['dir'] . $appendUploadFile->getKeyPath();

        $credentials = $credential['credentials'];
        // 检查必填参数
        if (! isset($credential['host']) || ! isset($credential['dir']) || ! isset($credentials['AccessKeyId']) || ! isset($credentials['SecretAccessKey']) || ! isset($credentials['SessionToken'])) {
            throw new CloudFileException('TOS upload credential is invalid');
        }

        // 先获取文件
        $key = $credential['dir'] . $appendUploadFile->getKeyPath();

        try {
            $fileContent = file_get_contents($appendUploadFile->getRealPath());
            if ($fileContent === false) {
                throw new CloudFileException('读取文件失败：' . $appendUploadFile->getRealPath());
            }

            $contentType = mime_content_type($appendUploadFile->getRealPath());
            $date = gmdate('D, d M Y H:i:s \G\M\T');

            $host = parse_url($credential['host'])['host'] ?? '';
            $headers = [
                'Host' => $host,
                'Content-Type' => $contentType,
                'Content-Length' => strlen($fileContent),
                'x-tos-security-token' => $credentials['SessionToken'],
                'Date' => $date,
                'x-tos-date' => $date,
            ];

            $request = TosSigner::sign(
                [
                    'headers' => $headers,
                    'method' => 'POST',
                    'key' => $object,
                    'queries' => [
                        'append' => '',
                        'offset' => (string) $appendUploadFile->getPosition(),
                    ],
                ],
                $host,
                $credentials['AccessKeyId'],
                $credentials['SecretAccessKey'],
                $credentials['SessionToken'],
                $credential['region']
            );

            $headers = $request['headers'];

            $body = file_get_contents($appendUploadFile->getRealPath());

            $url = $credential['host'] . '/' . $object . '?append&offset=' . $appendUploadFile->getPosition();
            CurlHelper::sendRequest($url, $body, $headers, 200);
        } catch (Throwable $exception) {
            $errorMsg = $exception->getMessage();
            throw $exception;
        } finally {
            if (isset($errorMsg)) {
                $this->sdkContainer->getLogger()->warning('simple_upload_fail', ['key' => $key, 'host' => $credential['host'], 'error_msg' => $errorMsg]);
            } else {
                $this->sdkContainer->getLogger()->info('simple_upload_success', ['key' => $key, 'host' => $credential['host']]);
            }
        }
        $appendUploadFile->setKey($key);
        $appendUploadFile->setPosition($appendUploadFile->getPosition() + $appendUploadFile->getSize());
    }

    /**
     * 使用STS token进行简单上传（适用于小文件）.
     *
     * @param array $credential STS凭证信息
     * @param UploadFile $uploadFile 上传文件对象
     * @throws CloudFileException
     */
    public function uploadBySts(array $credential, UploadFile $uploadFile): void
    {
        try {
            // 转换credential格式为SDK配置
            $sdkConfig = $this->convertCredentialToSdkConfig($credential);

            // 创建TOS官方SDK客户端
            $tosClient = new TosClient($sdkConfig);

            // 构建文件路径
            $dir = '';
            if (isset($credential['temporary_credential']['dir'])) {
                $dir = $credential['temporary_credential']['dir'];
            } elseif (isset($credential['dir'])) {
                $dir = $credential['dir'];
            }
            $key = $dir . $uploadFile->getKeyPath();

            // 读取文件内容
            $fileContent = file_get_contents($uploadFile->getRealPath());
            if ($fileContent === false) {
                throw new CloudFileException('Failed to read file: ' . $uploadFile->getRealPath());
            }

            // 使用TOS SDK进行简单上传
            $putInput = new PutObjectInput($sdkConfig['bucket'], $key);
            $putInput->setContent($fileContent);
            $putInput->setContentLength(strlen($fileContent));

            // 设置Content-Type
            if ($uploadFile->getMimeType()) {
                $putInput->setContentType($uploadFile->getMimeType());
            }

            $putOutput = $tosClient->putObject($putInput);

            // 设置上传结果
            $uploadFile->setKey($key);

            $this->sdkContainer->getLogger()->info('sts_upload_success', [
                'key' => $key,
                'bucket' => $sdkConfig['bucket'],
                'file_size' => strlen($fileContent),
                'etag' => $putOutput->getETag(),
            ]);
        } catch (TosClientException $exception) {
            $this->sdkContainer->getLogger()->error('sts_upload_client_error', [
                'key' => $key ?? 'unknown',
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('TOS SDK client error: ' . $exception->getMessage(), 0, $exception);
        } catch (TosServerException $exception) {
            $this->sdkContainer->getLogger()->error('sts_upload_server_error', [
                'key' => $key ?? 'unknown',
                'request_id' => $exception->getRequestId(),
                'status_code' => $exception->getStatusCode(),
                'error_code' => $exception->getErrorCode(),
            ]);
            throw new CloudFileException(
                sprintf(
                    'TOS server error: %s (RequestId: %s, StatusCode: %d)',
                    $exception->getErrorCode(),
                    $exception->getRequestId(),
                    $exception->getStatusCode()
                ),
                0,
                $exception
            );
        } catch (Throwable $exception) {
            $this->sdkContainer->getLogger()->error('sts_upload_failed', [
                'key' => $key ?? 'unknown',
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('STS upload failed: ' . $exception->getMessage(), 0, $exception);
        }
    }

    /**
     * 使用TOS官方SDK实现分片上传.
     *
     * @param array $credential 凭证信息
     * @param ChunkUploadFile $chunkUploadFile 分片上传文件对象
     * @throws ChunkUploadException
     */
    public function uploadObjectByChunks(array $credential, ChunkUploadFile $chunkUploadFile): void
    {
        // 检查是否需要分片上传
        if (! $chunkUploadFile->shouldUseChunkUpload()) {
            // 文件较小，使用STS简单上传
            $this->uploadBySts($credential, $chunkUploadFile);
            return;
        }

        // 转换credential格式为SDK配置
        $sdkConfig = $this->convertCredentialToSdkConfig($credential);

        // 创建TOS官方SDK客户端
        $tosClient = new TosClient($sdkConfig);

        // 计算分片信息
        $chunkUploadFile->calculateChunks();
        $chunks = $chunkUploadFile->getChunks();

        if (empty($chunks)) {
            throw ChunkUploadException::createInitFailed('No chunks calculated for upload');
        }

        $uploadId = '';
        $key = '';
        $bucket = $sdkConfig['bucket'];

        try {
            // 1. 创建分片上传任务
            $dir = '';
            if (isset($credential['temporary_credential']['dir'])) {
                $dir = $credential['temporary_credential']['dir'];
            } elseif (isset($credential['dir'])) {
                $dir = $credential['dir'];
            }
            $key = $dir . $chunkUploadFile->getKeyPath();
            $createInput = new CreateMultipartUploadInput($bucket, $key);

            // 设置Content-Type
            if ($chunkUploadFile->getMimeType()) {
                $createInput->setContentType($chunkUploadFile->getMimeType());
            }

            $createOutput = $tosClient->createMultipartUpload($createInput);
            $uploadId = $createOutput->getUploadID();

            $chunkUploadFile->setUploadId($uploadId);
            $chunkUploadFile->setKey($key);

            $this->sdkContainer->getLogger()->info('chunk_upload_init_success', [
                'upload_id' => $uploadId,
                'key' => $key,
                'chunk_count' => count($chunks),
                'total_size' => $chunkUploadFile->getSize(),
            ]);

            // 2. 上传分片
            $completedParts = $this->uploadChunksWithSdk($tosClient, $bucket, $key, $uploadId, $chunkUploadFile, $chunks);

            // 3. 合并分片
            $completeInput = new CompleteMultipartUploadInput($bucket, $key, $uploadId, $completedParts);
            $tosClient->completeMultipartUpload($completeInput);

            $this->sdkContainer->getLogger()->info('chunk_upload_success', [
                'upload_id' => $uploadId,
                'key' => $key,
                'chunk_count' => count($chunks),
                'total_size' => $chunkUploadFile->getSize(),
            ]);
        } catch (TosClientException $exception) {
            // SDK客户端异常
            $this->handleUploadError($tosClient, $bucket, $key, $uploadId, $exception);
            throw ChunkUploadException::createInitFailed(
                'TOS SDK client error: ' . $exception->getMessage(),
                $uploadId,
                $exception
            );
        } catch (TosServerException $exception) {
            // TOS服务端异常
            $this->handleUploadError($tosClient, $bucket, $key, $uploadId, $exception);
            throw ChunkUploadException::createInitFailed(
                sprintf(
                    'TOS server error: %s (RequestId: %s, StatusCode: %d)',
                    $exception->getErrorCode(),
                    $exception->getRequestId(),
                    $exception->getStatusCode()
                ),
                $uploadId,
                $exception
            );
        } catch (Throwable $exception) {
            // 其他异常
            $this->handleUploadError($tosClient, $bucket, $key, $uploadId, $exception);

            if ($exception instanceof ChunkUploadException) {
                throw $exception;
            }

            throw ChunkUploadException::createInitFailed(
                $exception->getMessage(),
                $uploadId,
                $exception
            );
        }
    }

    /**
     * List objects by credential using TOS SDK.
     *
     * @param array $credential Credential information
     * @param string $prefix Object prefix to filter
     * @param array $options Additional options (marker, max-keys, etc.)
     * @return array List of objects
     */
    public function listObjectsByCredential(array $credential, string $prefix = '', array $options = []): array
    {
        try {
            // Convert credential to SDK config
            $sdkConfig = $this->convertCredentialToSdkConfig($credential);

            // Create TOS SDK client
            $tosClient = new TosClient($sdkConfig);

            // Prepare list objects input
            $listInput = new ListObjectsInput($sdkConfig['bucket']);
            $listInput->setPrefix($prefix);
            if (isset($options['delimiter'])) {
                $listInput->setDelimiter($options['delimiter']);
            }

            // Set marker for pagination
            if (isset($options['marker'])) {
                $listInput->setMarker($options['marker']);
            }
            // Set max keys (default 1000, max 1000)
            $maxKeys = $options['max-keys'] ?? 1000;
            $listInput->setMaxKeys(min($maxKeys, 1000));

            // Execute list objects
            $listOutput = $tosClient->listObjects($listInput);

            // Format response
            $objects = [];
            foreach ($listOutput->getContents() as $object) {
                $objects[] = [
                    'key' => $object->getKey(),
                    'size' => $object->getSize(),
                    'last_modified' => $object->getLastModified(),
                    'etag' => $object->getETag(),
                    'storage_class' => $object->getStorageClass(),
                ];
            }

            $result = [
                'name' => $listOutput->getName(),
                'prefix' => $listOutput->getPrefix(),
                'marker' => $listOutput->getMarker(),
                'max_keys' => $listOutput->getMaxKeys(),
                'next_marker' => $listOutput->getNextMarker(),
                'objects' => $objects,
                'common_prefixes' => [],
            ];

            // Add common prefixes if available
            if ($listOutput->getCommonPrefixes()) {
                foreach ($listOutput->getCommonPrefixes() as $commonPrefix) {
                    $result['common_prefixes'][] = [
                        'prefix' => $commonPrefix->getPrefix(),
                    ];
                }
            }

            $this->sdkContainer->getLogger()->info('list_objects_success', [
                'bucket' => $sdkConfig['bucket'],
                'prefix' => $prefix,
                'object_count' => count($objects),
            ]);

            return $result;
        } catch (TosClientException $exception) {
            $this->sdkContainer->getLogger()->error('list_objects_client_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'prefix' => $prefix,
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('TOS SDK client error: ' . $exception->getMessage(), 0, $exception);
        } catch (TosServerException $exception) {
            $this->sdkContainer->getLogger()->error('list_objects_server_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'prefix' => $prefix,
                'request_id' => $exception->getRequestId(),
                'status_code' => $exception->getStatusCode(),
                'error_code' => $exception->getErrorCode(),
            ]);
            throw new CloudFileException(
                sprintf(
                    'TOS server error: %s (RequestId: %s, StatusCode: %d)',
                    $exception->getErrorCode(),
                    $exception->getRequestId(),
                    $exception->getStatusCode()
                ),
                0,
                $exception
            );
        } catch (Throwable $exception) {
            $this->sdkContainer->getLogger()->error('list_objects_failed', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'prefix' => $prefix,
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('List objects failed: ' . $exception->getMessage(), 0, $exception);
        }
    }

    /**
     * Delete object by credential using TOS SDK.
     *
     * @param array $credential Credential information
     * @param string $objectKey Object key to delete
     * @param array $options Additional options
     */
    public function deleteObjectByCredential(array $credential, string $objectKey, array $options = []): void
    {
        try {
            // Convert credential to SDK config
            $sdkConfig = $this->convertCredentialToSdkConfig($credential);

            // Create TOS SDK client
            $tosClient = new TosClient($sdkConfig);

            // Create delete object input
            $deleteInput = new DeleteObjectInput($sdkConfig['bucket'], $objectKey);

            // Set version ID if provided (for versioned buckets)
            if (isset($options['version_id'])) {
                $deleteInput->setVersionID($options['version_id']);
            }

            // Execute delete object
            $deleteOutput = $tosClient->deleteObject($deleteInput);

            $this->sdkContainer->getLogger()->info('delete_object_success', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'version_id' => $deleteOutput->getVersionID(),
            ]);
        } catch (TosClientException $exception) {
            $this->sdkContainer->getLogger()->error('delete_object_client_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('TOS SDK client error: ' . $exception->getMessage(), 0, $exception);
        } catch (TosServerException $exception) {
            $this->sdkContainer->getLogger()->error('delete_object_server_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'request_id' => $exception->getRequestId(),
                'status_code' => $exception->getStatusCode(),
                'error_code' => $exception->getErrorCode(),
            ]);
            throw new CloudFileException(
                sprintf(
                    'TOS server error: %s (RequestId: %s, StatusCode: %d)',
                    $exception->getErrorCode(),
                    $exception->getRequestId(),
                    $exception->getStatusCode()
                ),
                0,
                $exception
            );
        } catch (Throwable $exception) {
            $this->sdkContainer->getLogger()->error('delete_object_failed', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('Delete object failed: ' . $exception->getMessage(), 0, $exception);
        }
    }

    /**
     * Copy object by credential using TOS SDK.
     *
     * @param array $credential Credential information
     * @param string $sourceKey Source object key
     * @param string $destinationKey Destination object key
     * @param array $options Additional options
     */
    public function copyObjectByCredential(array $credential, string $sourceKey, string $destinationKey, array $options = []): void
    {
        try {
            // Convert credential to SDK config
            $sdkConfig = $this->convertCredentialToSdkConfig($credential);

            // Create TOS SDK client
            $tosClient = new TosClient($sdkConfig);

            // Set source bucket and key
            $sourceBucket = $options['source_bucket'] ?? $sdkConfig['bucket'];

            // Create copy object input with all required parameters
            $copyInput = new CopyObjectInput($sdkConfig['bucket'], $destinationKey, $sourceBucket, $sourceKey);

            // Set source version ID if provided
            if (isset($options['source_version_id'])) {
                $copyInput->setSrcVersionID($options['source_version_id']);
            }

            // Set metadata directive (COPY or REPLACE)
            $metadataDirective = $options['metadata_directive'] ?? 'COPY';
            $copyInput->setMetadataDirective($metadataDirective);

            // Set content type if provided
            if (isset($options['content_type'])) {
                $copyInput->setContentType($options['content_type']);
            }

            // Set Content-Disposition for download filename
            if (isset($options['download_name'])) {
                $downloadName = $options['download_name'];
                $contentDisposition = 'attachment; filename="' . addslashes($downloadName) . '"';
                $copyInput->setContentDisposition($contentDisposition);

                // When setting Content-Disposition, we should use REPLACE mode
                if ($metadataDirective === 'COPY') {
                    $metadataDirective = 'REPLACE';
                    $copyInput->setMetadataDirective($metadataDirective);
                }
            }

            // Set custom metadata if provided
            if (isset($options['metadata']) && is_array($options['metadata'])) {
                $copyInput->setMeta($options['metadata']);
            }

            // Set storage class if provided
            if (isset($options['storage_class'])) {
                $copyInput->setStorageClass($options['storage_class']);
            }

            // Execute copy object
            $copyOutput = $tosClient->copyObject($copyInput);

            $this->sdkContainer->getLogger()->info('copy_object_success', [
                'source_bucket' => $sourceBucket,
                'source_key' => $sourceKey,
                'destination_bucket' => $sdkConfig['bucket'],
                'destination_key' => $destinationKey,
                'etag' => $copyOutput->getETag(),
                'last_modified' => $copyOutput->getLastModified(),
            ]);
        } catch (TosClientException $exception) {
            $this->sdkContainer->getLogger()->error('copy_object_client_error', [
                'source_key' => $sourceKey,
                'destination_key' => $destinationKey,
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('TOS SDK client error: ' . $exception->getMessage(), 0, $exception);
        } catch (TosServerException $exception) {
            $this->sdkContainer->getLogger()->error('copy_object_server_error', [
                'source_key' => $sourceKey,
                'destination_key' => $destinationKey,
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'request_id' => $exception->getRequestId(),
                'status_code' => $exception->getStatusCode(),
                'error_code' => $exception->getErrorCode(),
            ]);
            throw new CloudFileException(
                sprintf(
                    'TOS server error: %s (RequestId: %s, StatusCode: %d)',
                    $exception->getErrorCode(),
                    $exception->getRequestId(),
                    $exception->getStatusCode()
                ),
                0,
                $exception
            );
        } catch (Throwable $exception) {
            $this->sdkContainer->getLogger()->error('copy_object_failed', [
                'source_key' => $sourceKey,
                'destination_key' => $destinationKey,
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('Copy object failed: ' . $exception->getMessage(), 0, $exception);
        }
    }

    /**
     * Get object metadata by credential using TOS SDK.
     *
     * @param array $credential Credential information
     * @param string $objectKey Object key to get metadata
     * @param array $options Additional options
     * @return array Object metadata
     */
    public function getHeadObjectByCredential(array $credential, string $objectKey, array $options = []): array
    {
        try {
            // Convert credential to SDK config
            $sdkConfig = $this->convertCredentialToSdkConfig($credential);

            // Create TOS SDK client
            $tosClient = new TosClient($sdkConfig);

            // Create head object input
            $headInput = new HeadObjectInput($sdkConfig['bucket'], $objectKey);

            // Set version ID if provided (for versioned buckets)
            if (isset($options['version_id'])) {
                $headInput->setVersionID($options['version_id']);
            }

            // Execute head object
            $headOutput = $tosClient->headObject($headInput);

            // Format response
            $metadata = [
                'content_length' => $headOutput->getContentLength(),
                'content_type' => $headOutput->getContentType(),
                'etag' => $headOutput->getETag(),
                'last_modified' => $headOutput->getLastModified(),
                'version_id' => $headOutput->getVersionID(),
                'storage_class' => $headOutput->getStorageClass(),
                'content_disposition' => $headOutput->getContentDisposition(),
                'content_encoding' => $headOutput->getContentEncoding(),
                'expires' => $headOutput->getExpires(),
                'meta' => $headOutput->getMeta(),
            ];

            $this->sdkContainer->getLogger()->info('head_object_success', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'content_length' => $metadata['content_length'],
                'last_modified' => $metadata['last_modified'],
            ]);

            return $metadata;
        } catch (TosClientException $exception) {
            $this->sdkContainer->getLogger()->error('head_object_client_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('TOS SDK client error: ' . $exception->getMessage(), 0, $exception);
        } catch (TosServerException $exception) {
            $this->sdkContainer->getLogger()->error('head_object_server_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'request_id' => $exception->getRequestId(),
                'status_code' => $exception->getStatusCode(),
                'error_code' => $exception->getErrorCode(),
            ]);

            // 如果对象不存在，抛出特定的异常
            if ($exception->getStatusCode() === 404) {
                throw new CloudFileException('Object not found: ' . $objectKey, 404, $exception);
            }

            throw new CloudFileException(
                sprintf(
                    'TOS server error: %s (RequestId: %s, StatusCode: %d)',
                    $exception->getErrorCode(),
                    $exception->getRequestId(),
                    $exception->getStatusCode()
                ),
                0,
                $exception
            );
        } catch (Throwable $exception) {
            $this->sdkContainer->getLogger()->error('head_object_failed', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('Head object failed: ' . $exception->getMessage(), 0, $exception);
        }
    }

    /**
     * Create object by credential using TOS SDK (file or folder).
     *
     * @param array $credential Credential information
     * @param string $objectKey Object key to create
     * @param array $options Additional options
     */
    public function createObjectByCredential(array $credential, string $objectKey, array $options = []): void
    {
        try {
            // Convert credential to SDK config
            $sdkConfig = $this->convertCredentialToSdkConfig($credential);

            // Create TOS SDK client
            $tosClient = new TosClient($sdkConfig);

            // Determine content based on object type
            $content = '';
            $isFolder = str_ends_with($objectKey, '/');

            if (isset($options['content'])) {
                $content = $options['content'];
            } elseif ($isFolder) {
                // For folders, always use empty content
                $content = '';
            }

            // Create put object input
            $putInput = new PutObjectInput($sdkConfig['bucket'], $objectKey);
            $putInput->setContent($content);
            $putInput->setContentLength(strlen($content));

            // Set content type
            if (isset($options['content_type'])) {
                $putInput->setContentType($options['content_type']);
            } elseif ($isFolder) {
                // For folders, use a specific content type
                $putInput->setContentType('application/x-directory');
            } else {
                // For files, try to determine content type from extension
                $extension = pathinfo($objectKey, PATHINFO_EXTENSION);
                $contentType = MimeTypes::getMimeType($extension);
                $putInput->setContentType($contentType);
            }

            // Set storage class if provided
            if (isset($options['storage_class'])) {
                $putInput->setStorageClass($options['storage_class']);
            }

            // Set custom metadata if provided
            if (isset($options['metadata']) && is_array($options['metadata'])) {
                $putInput->setMeta($options['metadata']);
            }

            // Set Content-Disposition if provided
            if (isset($options['content_disposition'])) {
                $putInput->setContentDisposition($options['content_disposition']);
            }

            // Execute put object
            $putOutput = $tosClient->putObject($putInput);

            $this->sdkContainer->getLogger()->info('create_object_success', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'object_type' => $isFolder ? 'folder' : 'file',
                'content_length' => strlen($content),
                'etag' => $putOutput->getETag(),
            ]);
        } catch (TosClientException $exception) {
            $this->sdkContainer->getLogger()->error('create_object_client_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('TOS SDK client error: ' . $exception->getMessage(), 0, $exception);
        } catch (TosServerException $exception) {
            $this->sdkContainer->getLogger()->error('create_object_server_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'request_id' => $exception->getRequestId(),
                'status_code' => $exception->getStatusCode(),
                'error_code' => $exception->getErrorCode(),
            ]);
            throw new CloudFileException(
                sprintf(
                    'TOS server error: %s (RequestId: %s, StatusCode: %d)',
                    $exception->getErrorCode(),
                    $exception->getRequestId(),
                    $exception->getStatusCode()
                ),
                0,
                $exception
            );
        } catch (Throwable $exception) {
            $this->sdkContainer->getLogger()->error('create_object_failed', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('Create object failed: ' . $exception->getMessage(), 0, $exception);
        }
    }

    /**
     * Generate pre-signed URL by credential using TOS SDK.
     *
     * @param array $credential Credential information
     * @param string $objectKey Object key to generate URL for
     * @param array $options Additional options
     * @return string Pre-signed URL
     */
    public function getPreSignedUrlByCredential(array $credential, string $objectKey, array $options = []): string
    {
        try {
            // Convert credential to SDK config
            $sdkConfig = $this->convertCredentialToSdkConfig($credential);

            // Create TOS SDK client
            $tosClient = new TosClient($sdkConfig);

            // Set expiration time (default 1 hour)
            $expires = $options['expires'] ?? 3600;

            $this->sdkContainer->getLogger()->info('TOS getPreSignedUrlByCredential request', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'method' => $options['method'] ?? 'GET',
                'expires' => $expires,
            ]);

            // Create pre-signed URL input
            // Note: TOS expects expires in seconds (duration), not absolute timestamp
            $preSignedInput = new PreSignedURLInput(
                $options['method'] ?? 'GET',
                $sdkConfig['bucket'],
                $objectKey,
                $expires
            );

            // Prepare headers array
            $headers = [];

            // Set response headers if specified
            if (isset($options['filename'])) {
                $filename = $options['filename'];
                $headers['response-content-disposition'] = 'attachment; filename="' . addslashes($filename) . '"';
            }

            if (isset($options['content_type'])) {
                $headers['response-content-type'] = $options['content_type'];
            }

            // Add custom response headers if provided
            if (isset($options['custom_headers']) && is_array($options['custom_headers'])) {
                foreach ($options['custom_headers'] as $headerName => $headerValue) {
                    $headers[$headerName] = (string) $headerValue;
                }
            }

            // Set all headers at once if any headers are defined
            if (! empty($headers)) {
                $preSignedInput->setHeader($headers);
            }

            if (isset($options['custom_query']) && is_array($options['custom_query'])) {
                $preSignedInput->setQuery($options['custom_query']);
            }

            // Generate pre-signed URL
            $preSignedOutput = $tosClient->preSignedURL($preSignedInput);
            $signedUrl = $preSignedOutput->getSignedUrl();

            $this->sdkContainer->getLogger()->info('get_presigned_url_success', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'method' => $options['method'] ?? 'GET',
                'expires' => $expires,
                'url_length' => strlen($signedUrl),
            ]);

            return $signedUrl;
        } catch (TosClientException $exception) {
            $this->sdkContainer->getLogger()->error('get_presigned_url_client_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('TOS SDK client error: ' . $exception->getMessage(), 0, $exception);
        } catch (TosServerException $exception) {
            $this->sdkContainer->getLogger()->error('get_presigned_url_server_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'request_id' => $exception->getRequestId(),
                'status_code' => $exception->getStatusCode(),
                'error_code' => $exception->getErrorCode(),
            ]);
            throw new CloudFileException(
                sprintf(
                    'TOS server error: %s (RequestId: %s, StatusCode: %d)',
                    $exception->getErrorCode(),
                    $exception->getRequestId(),
                    $exception->getStatusCode()
                ),
                0,
                $exception
            );
        } catch (Throwable $exception) {
            $this->sdkContainer->getLogger()->error('get_presigned_url_failed', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('Generate pre-signed URL failed: ' . $exception->getMessage(), 0, $exception);
        }
    }

    /**
     * Delete multiple objects by credential using TOS SDK.
     *
     * @param array $credential Credential information
     * @param array $objectKeys Array of object keys to delete
     * @param array $options Additional options
     * @return array Delete result with success and error information
     */
    public function deleteObjectsByCredential(array $credential, array $objectKeys, array $options = []): array
    {
        try {
            // Convert credential to SDK config
            $sdkConfig = $this->convertCredentialToSdkConfig($credential);

            // Create TOS SDK client
            $tosClient = new TosClient($sdkConfig);

            // Validate input
            if (empty($objectKeys)) {
                return [
                    'deleted' => [],
                    'errors' => [],
                ];
            }

            // TOS supports maximum 1000 objects per request
            $maxObjectsPerRequest = 1000;
            $allDeleted = [];
            $allErrors = [];

            // Process in chunks if there are more than 1000 objects
            $chunks = array_chunk($objectKeys, $maxObjectsPerRequest);

            foreach ($chunks as $chunk) {
                // Create objects to be deleted
                $objectsToDelete = [];
                foreach ($chunk as $objectKey) {
                    $objectsToDelete[] = new ObjectTobeDeleted($objectKey);
                }

                // Create delete input
                $deleteInput = new DeleteMultiObjectsInput($sdkConfig['bucket'], $objectsToDelete);

                // Set quiet mode based on options (default false to get detailed result)
                $quiet = $options['quiet'] ?? false;
                $deleteInput->setQuiet($quiet);

                $this->sdkContainer->getLogger()->info('TOS deleteObjectsByCredential request', [
                    'bucket' => $sdkConfig['bucket'],
                    'object_count' => count($chunk),
                    'quiet' => $quiet,
                ]);

                // Execute delete
                $deleteOutput = $tosClient->deleteMultiObjects($deleteInput);

                // Process successful deletions
                if ($deleteOutput->getDeleted()) {
                    foreach ($deleteOutput->getDeleted() as $deleted) {
                        $allDeleted[] = [
                            'key' => $deleted->getKey(),
                            'version_id' => $deleted->getVersionID(),
                            'delete_marker_version_id' => $deleted->getDeleteMarkerVersionID(),
                        ];
                    }
                }

                // Process errors
                if ($deleteOutput->getError()) {
                    foreach ($deleteOutput->getError() as $error) {
                        $allErrors[] = [
                            'key' => $error->getKey(),
                            'version_id' => $error->getVersionID(),
                            'code' => $error->getCode(),
                            'message' => $error->getMessage(),
                        ];
                    }
                }
            }

            $result = [
                'deleted' => $allDeleted,
                'errors' => $allErrors,
            ];

            $this->sdkContainer->getLogger()->info('delete_objects_success', [
                'bucket' => $sdkConfig['bucket'],
                'total_requested' => count($objectKeys),
                'total_deleted' => count($allDeleted),
                'total_errors' => count($allErrors),
            ]);

            return $result;
        } catch (TosClientException $exception) {
            $this->sdkContainer->getLogger()->error('delete_objects_client_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_count' => count($objectKeys),
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('TOS SDK client error: ' . $exception->getMessage(), 0, $exception);
        } catch (TosServerException $exception) {
            $this->sdkContainer->getLogger()->error('delete_objects_server_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_count' => count($objectKeys),
                'request_id' => $exception->getRequestId(),
                'status_code' => $exception->getStatusCode(),
                'error_code' => $exception->getErrorCode(),
            ]);
            throw new CloudFileException(
                sprintf(
                    'TOS server error: %s (RequestId: %s, StatusCode: %d)',
                    $exception->getErrorCode(),
                    $exception->getRequestId(),
                    $exception->getStatusCode()
                ),
                0,
                $exception
            );
        } catch (Throwable $exception) {
            $this->sdkContainer->getLogger()->error('delete_objects_failed', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_count' => count($objectKeys),
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('Delete objects failed: ' . $exception->getMessage(), 0, $exception);
        }
    }

    /**
     * Set object metadata by credential using TOS SDK.
     *
     * @param array $credential Credential information
     * @param string $objectKey Object key to set metadata
     * @param array $metadata Metadata to set
     * @param array $options Additional options
     */
    public function setHeadObjectByCredential(array $credential, string $objectKey, array $metadata, array $options = []): void
    {
        try {
            // Convert credential to SDK config
            $sdkConfig = $this->convertCredentialToSdkConfig($credential);

            // Create TOS SDK client
            $tosClient = new TosClient($sdkConfig);

            $this->sdkContainer->getLogger()->info('TOS setHeadObjectByCredential request', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'metadata_count' => count($metadata),
            ]);

            // Create set object meta input
            $setMetaInput = new SetObjectMetaInput($sdkConfig['bucket'], $objectKey);

            // Set standard HTTP headers if provided
            if (isset($metadata['content_type'])) {
                $setMetaInput->setContentType($metadata['content_type']);
            }
            if (isset($metadata['content_disposition'])) {
                $setMetaInput->setContentDisposition($metadata['content_disposition']);
            }
            if (isset($metadata['content_encoding'])) {
                $setMetaInput->setContentEncoding($metadata['content_encoding']);
            }
            if (isset($metadata['content_language'])) {
                $setMetaInput->setContentLanguage($metadata['content_language']);
            }
            if (isset($metadata['cache_control'])) {
                $setMetaInput->setCacheControl($metadata['cache_control']);
            }
            if (isset($metadata['expires'])) {
                $setMetaInput->setExpires($metadata['expires']);
            }

            // Set custom metadata (x-tos-meta-* headers)
            $customMeta = [];
            foreach ($metadata as $key => $value) {
                // Skip standard HTTP headers
                if (in_array($key, ['content_type', 'content_disposition', 'content_encoding', 'content_language', 'cache_control', 'expires'])) {
                    continue;
                }
                // Add custom metadata
                $customMeta[$key] = (string) $value;
            }

            if (! empty($customMeta)) {
                $setMetaInput->setMeta($customMeta);
            }

            // Execute set object metadata
            $setMetaOutput = $tosClient->setObjectMeta($setMetaInput);

            $this->sdkContainer->getLogger()->info('set_object_meta_success', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'request_id' => $setMetaOutput->getRequestId(),
                'metadata_count' => count($metadata),
            ]);
        } catch (TosClientException $exception) {
            $this->sdkContainer->getLogger()->error('set_object_meta_client_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('TOS SDK client error: ' . $exception->getMessage(), 0, $exception);
        } catch (TosServerException $exception) {
            $this->sdkContainer->getLogger()->error('set_object_meta_server_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'request_id' => $exception->getRequestId(),
                'status_code' => $exception->getStatusCode(),
                'error_code' => $exception->getErrorCode(),
            ]);
            throw new CloudFileException(
                sprintf(
                    'TOS server error: %s (RequestId: %s, StatusCode: %d)',
                    $exception->getErrorCode(),
                    $exception->getRequestId(),
                    $exception->getStatusCode()
                ),
                0,
                $exception
            );
        } catch (Throwable $exception) {
            $this->sdkContainer->getLogger()->error('set_object_meta_failed', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
            ]);
            throw new CloudFileException('Set object metadata failed: ' . $exception->getMessage(), 0, $exception);
        }
    }

    /**
     * 转换credential为TOS SDK配置格式.
     */
    private function convertCredentialToSdkConfig(array $credential): array
    {
        // 处理temporary_credential格式
        if (isset($credential['temporary_credential'])) {
            $tempCredential = $credential['temporary_credential'];

            return [
                'region' => $tempCredential['region'],
                'endpoint' => $tempCredential['endpoint'] ?? $tempCredential['host'],
                'ak' => $tempCredential['credentials']['AccessKeyId'],
                'sk' => $tempCredential['credentials']['SecretAccessKey'],
                'securityToken' => $tempCredential['credentials']['SessionToken'],
                'bucket' => $tempCredential['bucket'],
            ];
        }

        // 处理普通credential格式
        return [
            'region' => $credential['region'],
            'endpoint' => $credential['endpoint'] ?? $credential['host'],
            'ak' => $credential['credentials']['AccessKeyId'],
            'sk' => $credential['credentials']['SecretAccessKey'],
            'securityToken' => $credential['credentials']['SessionToken'],
            'bucket' => $credential['bucket'],
        ];
    }

    /**
     * 使用SDK上传分片.
     */
    private function uploadChunksWithSdk(
        TosClient $tosClient,
        string $bucket,
        string $key,
        string $uploadId,
        ChunkUploadFile $chunkUploadFile,
        array $chunks
    ): array {
        $config = $chunkUploadFile->getChunkConfig();
        $completedParts = [];
        $uploadedBytes = 0;

        foreach ($chunks as $chunk) {
            $retryCount = 0;
            $uploaded = false;

            while (! $uploaded && $retryCount <= $config->getMaxRetries()) {
                try {
                    if ($chunkUploadFile->getProgressCallback()) {
                        $chunkUploadFile->getProgressCallback()->onChunkStart(
                            $chunk->getPartNumber(),
                            $chunk->getSize()
                        );
                    }

                    // 读取分片数据
                    $chunkData = $this->readChunkData($chunkUploadFile, $chunk);

                    // 使用SDK上传分片
                    $uploadInput = new UploadPartInput($bucket, $key, $uploadId, $chunk->getPartNumber());
                    $uploadInput->setContent($chunkData);
                    $uploadInput->setContentLength($chunk->getSize());

                    $uploadOutput = $tosClient->uploadPart($uploadInput);
                    $etag = $uploadOutput->getETag();

                    $chunk->markAsCompleted($etag);
                    $completedParts[] = new UploadedPart($chunk->getPartNumber(), $etag);
                    $uploadedBytes += $chunk->getSize();
                    $uploaded = true;

                    if ($chunkUploadFile->getProgressCallback()) {
                        $chunkUploadFile->getProgressCallback()->onChunkComplete(
                            $chunk->getPartNumber(),
                            $chunk->getSize(),
                            $etag
                        );

                        $chunkUploadFile->getProgressCallback()->onProgress(
                            count($completedParts),
                            count($chunks),
                            $uploadedBytes,
                            $chunkUploadFile->getSize()
                        );
                    }
                } catch (Throwable $exception) {
                    ++$retryCount;
                    $chunk->markAsFailed($exception);

                    if ($chunkUploadFile->getProgressCallback()) {
                        $chunkUploadFile->getProgressCallback()->onChunkError(
                            $chunk->getPartNumber(),
                            $chunk->getSize(),
                            $exception->getMessage(),
                            $retryCount
                        );
                    }

                    if ($retryCount > $config->getMaxRetries()) {
                        throw ChunkUploadException::createRetryExhausted(
                            $uploadId,
                            $chunk->getPartNumber(),
                            $config->getMaxRetries()
                        );
                    }

                    // 指数退避重试
                    usleep($config->getRetryDelay() * 1000 * (2 ** ($retryCount - 1)));
                }
            }
        }

        return $completedParts;
    }

    /**
     * 读取分片数据.
     * @param mixed $chunk
     */
    private function readChunkData(ChunkUploadFile $chunkUploadFile, $chunk): string
    {
        $handle = fopen($chunkUploadFile->getRealPath(), 'rb');
        if (! $handle) {
            throw ChunkUploadException::createPartUploadFailed(
                'Failed to open file for reading',
                $chunkUploadFile->getUploadId(),
                $chunk->getPartNumber()
            );
        }

        fseek($handle, $chunk->getStart());
        $data = fread($handle, $chunk->getSize());
        fclose($handle);

        if ($data === false) {
            throw ChunkUploadException::createPartUploadFailed(
                'Failed to read chunk data',
                $chunkUploadFile->getUploadId(),
                $chunk->getPartNumber()
            );
        }

        return $data;
    }

    /**
     * 处理上传错误，尝试清理分片上传.
     */
    private function handleUploadError(TosClient $tosClient, string $bucket, string $key, string $uploadId, Throwable $exception): void
    {
        if (! empty($uploadId) && ! empty($key) && ! empty($bucket)) {
            try {
                $abortInput = new AbortMultipartUploadInput($bucket, $key, $uploadId);
                $tosClient->abortMultipartUpload($abortInput);
            } catch (Throwable $abortException) {
                $this->sdkContainer->getLogger()->warning('abort_multipart_upload_failed', [
                    'upload_id' => $uploadId,
                    'key' => $key,
                    'bucket' => $bucket,
                    'error' => $abortException->getMessage(),
                ]);
            }
        }

        $this->sdkContainer->getLogger()->error('chunk_upload_failed', [
            'upload_id' => $uploadId,
            'key' => $key,
            'bucket' => $bucket,
            'error' => $exception->getMessage(),
        ]);
    }
}
