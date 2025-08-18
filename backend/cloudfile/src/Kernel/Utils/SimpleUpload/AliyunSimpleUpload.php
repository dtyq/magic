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
use OSS\Core\OssException;
use OSS\Credentials\StaticCredentialsProvider;
use OSS\OssClient;
use Throwable;

class AliyunSimpleUpload extends SimpleUpload
{
    private array $signKeyList = [
        'acl', 'uploads', 'location', 'cors',
        'logging', 'website', 'referer', 'lifecycle',
        'delete', 'append', 'tagging', 'objectMeta',
        'uploadId', 'partNumber', 'security-token', 'x-oss-security-token',
        'position', 'img', 'style', 'styleName',
        'replication', 'replicationProgress',
        'replicationLocation', 'cname', 'bucketInfo',
        'comp', 'qos', 'live', 'status', 'vod',
        'startTime', 'endTime', 'symlink',
        'x-oss-process', 'response-content-type', 'x-oss-traffic-limit',
        'response-content-language', 'response-expires',
        'response-cache-control', 'response-content-disposition',
        'response-content-encoding', 'udf', 'udfName', 'udfImage',
        'udfId', 'udfImageDesc', 'udfApplication',
        'udfApplicationLog', 'restore', 'callback', 'callback-var', 'qosInfo',
        'policy', 'stat', 'encryption', 'versions', 'versioning', 'versionId', 'requestPayment',
        'x-oss-request-payer', 'sequential',
        'inventory', 'inventoryId', 'continuation-token', 'asyncFetch',
        'worm', 'wormId', 'wormExtend', 'withHashContext',
        'x-oss-enable-md5', 'x-oss-enable-sha1', 'x-oss-enable-sha256',
        'x-oss-hash-ctx', 'x-oss-md5-ctx', 'transferAcceleration',
        'regionList', 'cloudboxes', 'x-oss-ac-source-ip', 'x-oss-ac-subnet-mask', 'x-oss-ac-vpc-id', 'x-oss-ac-forward-allow',
        'metaQuery', 'resourceGroup', 'rtc', 'x-oss-async-process', 'responseHeader',
    ];

    /**
     * @see https://help.aliyun.com/document_detail/31926.html
     */
    public function uploadObject(array $credential, UploadFile $uploadFile): void
    {
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }
        // 检查必填参数
        if (! isset($credential['host']) || ! isset($credential['dir']) || ! isset($credential['policy']) || ! isset($credential['accessid']) || ! isset($credential['signature'])) {
            throw new CloudFileException('Oss upload credential is invalid');
        }
        $key = $credential['dir'] . $uploadFile->getKeyPath();

        $body = [
            'key' => $key,
            'policy' => $credential['policy'],
            'OSSAccessKeyId' => $credential['accessid'],
            'success_action_status' => 200,
            'signature' => $credential['signature'],
            'callback' => '',
            'file' => curl_file_create($uploadFile->getRealPath(), $uploadFile->getMimeType(), $uploadFile->getName()),
        ];
        try {
            CurlHelper::sendRequest($credential['host'], $body, ['Content-Type' => 'multipart/form-data'], 200);
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

    /**
     * OSS chunk upload implementation - using official SDK's multiuploadFile method.
     * @see https://help.aliyun.com/zh/oss/developer-reference/multipart-upload
     */
    public function uploadObjectByChunks(array $credential, ChunkUploadFile $chunkUploadFile): void
    {
        // Check if chunk upload is needed
        if (! $chunkUploadFile->shouldUseChunkUpload()) {
            // File is small, use simple upload
            $this->uploadObjectWithSts($credential, $chunkUploadFile);
            return;
        }

        // Convert credential format to SDK configuration
        $sdkConfig = $this->convertCredentialToSdkConfig($credential);

        // Create OSS official SDK client
        $ossClient = $this->createOssClient($sdkConfig);

        $bucket = $sdkConfig['bucket'];
        $dir = $sdkConfig['dir'] ?? '';
        $key = $dir . $chunkUploadFile->getKeyPath();
        $filePath = $chunkUploadFile->getRealPath();

        try {
            $chunkUploadFile->setKey($key);

            $this->sdkContainer->getLogger()->info('chunk_upload_start', [
                'key' => $key,
                'file_size' => $chunkUploadFile->getSize(),
                'chunk_size' => $chunkUploadFile->getChunkConfig()->getChunkSize(),
            ]);

            // Configure chunk upload options
            $options = [
                OssClient::OSS_CONTENT_TYPE => $chunkUploadFile->getMimeType() ?: 'application/octet-stream',
                // Set chunk size
                OssClient::OSS_PART_SIZE => $chunkUploadFile->getChunkConfig()->getChunkSize(),
                // Enable MD5 verification
                OssClient::OSS_CHECK_MD5 => true,
            ];

            // Use official SDK's multiuploadFile method to handle chunk upload automatically
            $ossClient->multiuploadFile($bucket, $key, $filePath, $options);

            $this->sdkContainer->getLogger()->info('chunk_upload_success', [
                'key' => $key,
                'file_size' => $chunkUploadFile->getSize(),
            ]);
        } catch (OssException $exception) {
            // OSS SDK exception
            $this->sdkContainer->getLogger()->error('chunk_upload_failed', [
                'key' => $key,
                'bucket' => $bucket,
                'error' => $exception->getMessage(),
                'error_code' => $exception->getErrorCode(),
                'request_id' => $exception->getRequestId(),
            ]);

            throw ChunkUploadException::createInitFailed(
                sprintf(
                    'OSS SDK error: %s (ErrorCode: %s, RequestId: %s)',
                    $exception->getMessage(),
                    $exception->getErrorCode(),
                    $exception->getRequestId()
                ),
                '',
                $exception
            );
        } catch (Throwable $exception) {
            // Other exceptions
            $this->sdkContainer->getLogger()->error('chunk_upload_failed', [
                'key' => $key,
                'bucket' => $bucket,
                'error' => $exception->getMessage(),
            ]);

            if ($exception instanceof ChunkUploadException) {
                throw $exception;
            }

            throw ChunkUploadException::createInitFailed(
                $exception->getMessage(),
                '',
                $exception
            );
        }
    }

    /**
     * @see https://help.aliyun.com/zh/oss/developer-reference/appendobject
     */
    public function appendUploadObject(array $credential, AppendUploadFile $appendUploadFile): void
    {
        // Handle FileService credential structure (temporary_credential wrapper)
        if (isset($credential['temporary_credential'])) {
            $credential = $credential['temporary_credential'];
        }

        $object = ($credential['dir'] ?? '') . $appendUploadFile->getKeyPath();

        // Check required parameters
        if (! isset($credential['host']) || ! isset($credential['dir']) || ! isset($credential['access_key_id']) || ! isset($credential['access_key_secret'])) {
            throw new CloudFileException('Oss upload credential is invalid');
        }

        // Get the file first
        $key = $credential['dir'] . $appendUploadFile->getKeyPath();

        try {
            $fileContent = file_get_contents($appendUploadFile->getRealPath());
            if ($fileContent === false) {
                throw new CloudFileException('Failed to read file: ' . $appendUploadFile->getRealPath());
            }

            $contentType = mime_content_type($appendUploadFile->getRealPath());
            $date = gmdate('D, d M Y H:i:s \G\M\T');

            $headers = [
                'Host' => parse_url($credential['host'])['host'] ?? '',
                'Content-Type' => $contentType,
                'Content-Length' => strlen($fileContent),
                'Content-Md5' => base64_encode(md5($fileContent, true)),
                'x-oss-security-token' => $credential['sts_token'],
                'Date' => $date,
            ];

            $stringToSign = $this->aliyunCalcStringToSign('POST', $date, $headers, '/' . $credential['bucket'] . '/' . $key, [
                'append' => '',
                'position' => (string) $appendUploadFile->getPosition(),
            ]);
            $signature = base64_encode(hash_hmac('sha1', $stringToSign, $credential['access_key_secret'], true));
            $headers['Authorization'] = 'OSS ' . $credential['access_key_id'] . ':' . $signature;

            $body = file_get_contents($appendUploadFile->getRealPath());

            $url = $credential['host'] . '/' . $object . '?append&position=' . $appendUploadFile->getPosition();
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
     * List objects by credential using OSS SDK.
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

            // Create OSS SDK client
            $ossClient = $this->createOssClient($sdkConfig);

            // Prepare list options
            $listOptions = [
                OssClient::OSS_PREFIX => $prefix,
                OssClient::OSS_MAX_KEYS => min($options['max-keys'] ?? 1000, 1000),
            ];

            // Set marker for pagination
            if (isset($options['marker'])) {
                $listOptions[OssClient::OSS_MARKER] = $options['marker'];
            }

            // Set delimiter
            if (isset($options['delimiter'])) {
                $listOptions[OssClient::OSS_DELIMITER] = $options['delimiter'];
            }

            // Execute list objects
            $listInfo = $ossClient->listObjects($sdkConfig['bucket'], $listOptions);

            // Format response
            $objects = [];
            foreach ($listInfo->getObjectList() as $objectInfo) {
                $objects[] = [
                    'key' => $objectInfo->getKey(),
                    'size' => $objectInfo->getSize(),
                    'last_modified' => $objectInfo->getLastModified(),
                    'etag' => $objectInfo->getETag(),
                    'storage_class' => $objectInfo->getStorageClass(),
                ];
            }

            $result = [
                'name' => $sdkConfig['bucket'],
                'prefix' => $listInfo->getPrefix(),
                'marker' => $listInfo->getMarker(),
                'max_keys' => $listInfo->getMaxKeys(),
                'next_marker' => $listInfo->getNextMarker(),
                'objects' => $objects,
                'common_prefixes' => [],
            ];

            // Add common prefixes if available
            if ($listInfo->getPrefixList()) {
                foreach ($listInfo->getPrefixList() as $prefixInfo) {
                    $result['common_prefixes'][] = [
                        'prefix' => $prefixInfo->getPrefix(),
                    ];
                }
            }

            $this->sdkContainer->getLogger()->info('list_objects_success', [
                'bucket' => $sdkConfig['bucket'],
                'prefix' => $prefix,
                'object_count' => count($objects),
            ]);

            return $result;
        } catch (OssException $exception) {
            $this->sdkContainer->getLogger()->error('list_objects_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'prefix' => $prefix,
                'error' => $exception->getMessage(),
                'error_code' => $exception->getErrorCode(),
                'request_id' => $exception->getRequestId(),
            ]);
            throw new CloudFileException('OSS SDK error: ' . $exception->getMessage(), 0, $exception);
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
     * Delete object by credential using OSS SDK.
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

            // Create OSS SDK client
            $ossClient = $this->createOssClient($sdkConfig);

            // Execute delete object
            $ossClient->deleteObject($sdkConfig['bucket'], $objectKey);

            $this->sdkContainer->getLogger()->info('delete_object_success', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
            ]);
        } catch (OssException $exception) {
            $this->sdkContainer->getLogger()->error('delete_object_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
                'error_code' => $exception->getErrorCode(),
                'request_id' => $exception->getRequestId(),
            ]);
            throw new CloudFileException('OSS SDK error: ' . $exception->getMessage(), 0, $exception);
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
     * Copy object by credential using OSS SDK.
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

            // Create OSS SDK client
            $ossClient = $this->createOssClient($sdkConfig);

            // Set source bucket and key
            $sourceBucket = $options['source_bucket'] ?? $sdkConfig['bucket'];

            // Prepare copy options
            $copyOptions = [];

            // For OSS, when we need to change metadata, we use REPLACE directive
            $needsReplace = isset($options['content_type'])
                          || isset($options['download_name'])
                          || isset($options['metadata'])
                          || isset($options['storage_class']);

            if ($needsReplace) {
                $copyOptions[OssClient::OSS_HEADERS]['x-oss-metadata-directive'] = 'REPLACE';

                // Set content type if provided
                if (isset($options['content_type'])) {
                    $copyOptions[OssClient::OSS_CONTENT_TYPE] = $options['content_type'];
                }

                // Set Content-Disposition for download filename
                if (isset($options['download_name'])) {
                    $downloadName = $options['download_name'];
                    $contentDisposition = 'attachment; filename="' . addslashes($downloadName) . '"';
                    $copyOptions[OssClient::OSS_HEADERS]['Content-Disposition'] = $contentDisposition;
                }

                // Set custom metadata if provided
                if (isset($options['metadata']) && is_array($options['metadata'])) {
                    foreach ($options['metadata'] as $key => $value) {
                        $copyOptions[OssClient::OSS_HEADERS]['x-oss-meta-' . $key] = $value;
                    }
                }

                // Set storage class if provided
                if (isset($options['storage_class'])) {
                    $copyOptions[OssClient::OSS_HEADERS]['x-oss-storage-class'] = $options['storage_class'];
                }
            }

            // Execute copy object
            $ossClient->copyObject($sourceBucket, $sourceKey, $sdkConfig['bucket'], $destinationKey, $copyOptions);

            $this->sdkContainer->getLogger()->info('copy_object_success', [
                'source_bucket' => $sourceBucket,
                'source_key' => $sourceKey,
                'destination_bucket' => $sdkConfig['bucket'],
                'destination_key' => $destinationKey,
            ]);
        } catch (OssException $exception) {
            $this->sdkContainer->getLogger()->error('copy_object_error', [
                'source_key' => $sourceKey,
                'destination_key' => $destinationKey,
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'error' => $exception->getMessage(),
                'error_code' => $exception->getErrorCode(),
                'request_id' => $exception->getRequestId(),
            ]);
            throw new CloudFileException('OSS SDK error: ' . $exception->getMessage(), 0, $exception);
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
     * Get object metadata by credential using OSS SDK.
     *
     * @param array $credential Credential information
     * @param string $objectKey Object key to get metadata
     * @param array $options Additional options
     * @return array Object metadata
     * @throws CloudFileException
     */
    public function getHeadObjectByCredential(array $credential, string $objectKey, array $options = []): array
    {
        try {
            // Convert credential to SDK config
            $sdkConfig = $this->convertCredentialToSdkConfig($credential);

            // Create OSS SDK client
            $ossClient = $this->createOssClient($sdkConfig);

            // Execute get object meta
            $objectMeta = $ossClient->getObjectMeta($sdkConfig['bucket'], $objectKey);

            // Format response
            $metadata = [
                'content_length' => (int) ($objectMeta['content-length'] ?? 0),
                'content_type' => $objectMeta['content-type'] ?? '',
                'etag' => $objectMeta['etag'] ?? '',
                'last_modified' => isset($objectMeta['last-modified']) ? strtotime($objectMeta['last-modified']) : null,
                'version_id' => $objectMeta['x-oss-version-id'] ?? null,
                'storage_class' => $objectMeta['x-oss-storage-class'] ?? null,
                'content_disposition' => $objectMeta['content-disposition'] ?? null,
                'content_encoding' => $objectMeta['content-encoding'] ?? null,
                'expires' => $objectMeta['expires'] ?? null,
                'meta' => [],
            ];

            // Extract custom metadata
            foreach ($objectMeta as $key => $value) {
                if (strpos($key, 'x-oss-meta-') === 0) {
                    $metaKey = substr($key, 11); // Remove 'x-oss-meta-' prefix
                    $metadata['meta'][$metaKey] = $value;
                }
            }

            $this->sdkContainer->getLogger()->info('head_object_success', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'content_length' => $metadata['content_length'],
                'last_modified' => $metadata['last_modified'],
            ]);

            return $metadata;
        } catch (OssException $exception) {
            $this->sdkContainer->getLogger()->error('head_object_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
                'error_code' => $exception->getErrorCode(),
                'request_id' => $exception->getRequestId(),
                'http_status' => $exception->getHTTPStatus(),
            ]);

            // If object not found, throw specific exception
            // OSS returns 404 status code for missing objects
            if ($exception->getHTTPStatus() == 404 || $exception->getHTTPStatus() === '404') {
                throw new CloudFileException('Object not found: ' . $objectKey, 404, $exception);
            }

            throw new CloudFileException('OSS SDK error: ' . $exception->getMessage(), 0, $exception);
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
     * Create object by credential using OSS SDK (file or folder).
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

            // Create OSS SDK client
            $ossClient = $this->createOssClient($sdkConfig);

            // Determine content based on object type
            $content = '';
            $isFolder = str_ends_with($objectKey, '/');

            if (isset($options['content'])) {
                $content = $options['content'];
            } elseif ($isFolder) {
                // For folders, always use empty content
                $content = '';
            }

            // Prepare put options
            $putOptions = [];

            // Set content type
            if (isset($options['content_type'])) {
                $putOptions[OssClient::OSS_CONTENT_TYPE] = $options['content_type'];
            } elseif ($isFolder) {
                // For folders, use a specific content type
                $putOptions[OssClient::OSS_CONTENT_TYPE] = 'application/x-directory';
            } else {
                // For files, try to determine content type from extension
                $extension = pathinfo($objectKey, PATHINFO_EXTENSION);
                $contentType = MimeTypes::getMimeType($extension);
                $putOptions[OssClient::OSS_CONTENT_TYPE] = $contentType;
            }

            // Set storage class if provided
            if (isset($options['storage_class'])) {
                $putOptions[OssClient::OSS_HEADERS]['x-oss-storage-class'] = $options['storage_class'];
            }

            // Set custom metadata if provided
            if (isset($options['metadata']) && is_array($options['metadata'])) {
                foreach ($options['metadata'] as $key => $value) {
                    $putOptions[OssClient::OSS_HEADERS]['x-oss-meta-' . $key] = $value;
                }
            }

            // Set Content-Disposition if provided
            if (isset($options['content_disposition'])) {
                $putOptions[OssClient::OSS_HEADERS]['Content-Disposition'] = $options['content_disposition'];
            }

            // Execute put object
            $ossClient->putObject($sdkConfig['bucket'], $objectKey, $content, $putOptions);

            $this->sdkContainer->getLogger()->info('create_object_success', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'object_type' => $isFolder ? 'folder' : 'file',
                'content_length' => strlen($content),
            ]);
        } catch (OssException $exception) {
            $this->sdkContainer->getLogger()->error('create_object_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
                'error_code' => $exception->getErrorCode(),
                'request_id' => $exception->getRequestId(),
            ]);
            throw new CloudFileException('OSS SDK error: ' . $exception->getMessage(), 0, $exception);
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
     * Generate pre-signed URL by credential using OSS SDK.
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

            // Create OSS SDK client
            $ossClient = $this->createOssClient($sdkConfig);

            // Set expiration time (default 1 hour)
            $expires = $options['expires'] ?? 3600;

            $this->sdkContainer->getLogger()->info('Aliyun OSS getPreSignedUrlByCredential request', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'method' => $options['method'] ?? 'GET',
                'expires' => $expires,
            ]);

            // Prepare signed URL options
            // For OSS signUrl, response override parameters are set directly in options array
            $signedUrlOptions = [];

            // Set response headers if specified
            if (isset($options['filename'])) {
                $filename = $options['filename'];
                $signedUrlOptions['response-content-disposition']
                    = 'attachment; filename="' . addslashes($filename) . '"';
            }

            // Generate signed URL - pass relative seconds, not absolute timestamp
            $method = $options['method'] ?? 'GET';
            $signedUrl = $ossClient->signUrl($sdkConfig['bucket'], $objectKey, $expires, $method, $signedUrlOptions);

            $this->sdkContainer->getLogger()->info('get_presigned_url_success', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'method' => $method,
                'expires' => $expires,
                'url_length' => strlen($signedUrl),
            ]);

            return $signedUrl;
        } catch (OssException $exception) {
            $this->sdkContainer->getLogger()->error('get_presigned_url_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
                'error_code' => $exception->getErrorCode(),
                'request_id' => $exception->getRequestId(),
            ]);
            throw new CloudFileException('OSS SDK error: ' . $exception->getMessage(), 0, $exception);
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
     * Delete multiple objects by credential using Aliyun OSS SDK.
     *
     * @param array $credential Credential information
     * @param array $objectKeys Array of object keys to delete
     * @param array $options Additional options
     * @return array Delete result with success and error information
     * @throws CloudFileException
     */
    public function deleteObjectsByCredential(array $credential, array $objectKeys, array $options = []): array
    {
        try {
            // Convert credential to SDK config
            $sdkConfig = $this->convertCredentialToSdkConfig($credential);

            // Create Aliyun OSS client
            $ossClient = $this->createOssClient($sdkConfig);

            // Validate input
            if (empty($objectKeys)) {
                return [
                    'deleted' => [],
                    'errors' => [],
                ];
            }

            // Aliyun OSS supports maximum 1000 objects per request
            $maxObjectsPerRequest = 1000;
            $allDeleted = [];
            $allErrors = [];

            // Process in chunks if there are more than 1000 objects
            $chunks = array_chunk($objectKeys, $maxObjectsPerRequest);

            foreach ($chunks as $chunk) {
                $this->sdkContainer->getLogger()->info('Aliyun OSS deleteObjectsByCredential request', [
                    'bucket' => $sdkConfig['bucket'],
                    'object_count' => count($chunk),
                ]);

                // Execute batch delete using Aliyun OSS deleteObjects method
                $deleteResult = $ossClient->deleteObjects($sdkConfig['bucket'], $chunk);

                // Process results - Aliyun OSS deleteObjects returns array of successfully deleted objects
                // If no exceptions are thrown, all objects in the chunk were successfully deleted
                foreach ($chunk as $objectKey) {
                    $allDeleted[] = [
                        'key' => $objectKey,
                        'version_id' => null, // Aliyun doesn't return version info for simple delete
                        'delete_marker' => false,
                        'delete_marker_version_id' => null,
                    ];
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
            ]);

            return $result;
        } catch (OssException $exception) {
            $this->sdkContainer->getLogger()->error('delete_objects_oss_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_count' => count($objectKeys),
                'error' => $exception->getMessage(),
                'error_code' => $exception->getErrorCode(),
                'request_id' => $exception->getRequestId(),
            ]);
            throw new CloudFileException('OSS SDK error: ' . $exception->getMessage(), 0, $exception);
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
     * Set object metadata by credential using Aliyun OSS SDK.
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

            // Create OSS SDK client
            $ossClient = $this->createOssClient($sdkConfig);

            $this->sdkContainer->getLogger()->info('Aliyun OSS setHeadObjectByCredential request', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'metadata_count' => count($metadata),
            ]);

            // Prepare copy options for metadata modification
            // In Aliyun OSS, modifying metadata is done through copyObject with REPLACE directive
            $copyOptions = [
                OssClient::OSS_HEADERS => [
                    // Set metadata directive to REPLACE - ignore source metadata and use new metadata
                    'x-oss-metadata-directive' => 'REPLACE',
                ],
            ];

            // Set standard HTTP headers if provided
            if (isset($metadata['content_type'])) {
                $copyOptions[OssClient::OSS_HEADERS]['Content-Type'] = $metadata['content_type'];
            }
            if (isset($metadata['content_disposition'])) {
                $copyOptions[OssClient::OSS_HEADERS]['Content-Disposition'] = $metadata['content_disposition'];
            }
            if (isset($metadata['content_encoding'])) {
                $copyOptions[OssClient::OSS_HEADERS]['Content-Encoding'] = $metadata['content_encoding'];
            }
            if (isset($metadata['content_language'])) {
                $copyOptions[OssClient::OSS_HEADERS]['Content-Language'] = $metadata['content_language'];
            }
            if (isset($metadata['cache_control'])) {
                $copyOptions[OssClient::OSS_HEADERS]['Cache-Control'] = $metadata['cache_control'];
            }
            if (isset($metadata['expires'])) {
                $copyOptions[OssClient::OSS_HEADERS]['Expires'] = $metadata['expires'];
            }

            // Set custom metadata (x-oss-meta-* headers)
            foreach ($metadata as $key => $value) {
                // Skip standard HTTP headers
                if (in_array($key, ['content_type', 'content_disposition', 'content_encoding', 'content_language', 'cache_control', 'expires'])) {
                    continue;
                }
                // Add custom metadata with x-oss-meta- prefix
                $copyOptions[OssClient::OSS_HEADERS]['x-oss-meta-' . $key] = (string) $value;
            }

            // Execute copy object to same location with new metadata (metadata modification)
            $ossClient->copyObject(
                $sdkConfig['bucket'], // source bucket
                $objectKey,           // source object
                $sdkConfig['bucket'], // destination bucket (same as source)
                $objectKey,           // destination object (same as source)
                $copyOptions
            );

            $this->sdkContainer->getLogger()->info('set_object_meta_success', [
                'bucket' => $sdkConfig['bucket'],
                'object_key' => $objectKey,
                'metadata_count' => count($metadata),
            ]);
        } catch (OssException $exception) {
            $this->sdkContainer->getLogger()->error('set_object_meta_oss_error', [
                'bucket' => $sdkConfig['bucket'] ?? 'unknown',
                'object_key' => $objectKey,
                'error' => $exception->getMessage(),
                'error_code' => $exception->getErrorCode(),
                'request_id' => $exception->getRequestId(),
            ]);
            throw new CloudFileException('OSS SDK error: ' . $exception->getMessage(), 0, $exception);
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
     * Upload single object using STS credential via OSS SDK.
     * @see https://help.aliyun.com/zh/oss/developer-reference/simple-upload
     */
    private function uploadObjectWithSts(array $credential, UploadFile $uploadFile): void
    {
        $key = '';
        try {
            // Convert credential format to SDK configuration
            $sdkConfig = $this->convertCredentialToSdkConfig($credential);

            // Create OSS client with STS credential
            $ossClient = $this->createOssClient($sdkConfig);

            $bucket = $sdkConfig['bucket'];
            $dir = $sdkConfig['dir'] ?? '';
            $key = $dir . $uploadFile->getKeyPath();
            $filePath = $uploadFile->getRealPath();

            // Set upload options
            $options = [
                OssClient::OSS_CONTENT_TYPE => $uploadFile->getMimeType() ?: 'application/octet-stream',
            ];

            // Use OSS SDK's uploadFile method for simple upload
            $ossClient->uploadFile($bucket, $key, $filePath, $options);

            $uploadFile->setKey($key);

            $this->sdkContainer->getLogger()->info('simple_upload_success_sts', [
                'key' => $key,
                'bucket' => $bucket,
                'file_size' => $uploadFile->getSize(),
            ]);
        } catch (OssException $exception) {
            $this->sdkContainer->getLogger()->error('simple_upload_fail_sts', [
                'key' => $key,
                'bucket' => $sdkConfig['bucket'] ?? '',
                'error' => $exception->getMessage(),
                'error_code' => $exception->getErrorCode(),
                'request_id' => $exception->getRequestId(),
            ]);

            throw new CloudFileException(
                sprintf(
                    'OSS STS simple upload failed: %s (ErrorCode: %s, RequestId: %s)',
                    $exception->getMessage(),
                    $exception->getErrorCode(),
                    $exception->getRequestId()
                ),
                0,
                $exception
            );
        } catch (Throwable $exception) {
            $this->sdkContainer->getLogger()->error('simple_upload_fail_sts', [
                'key' => $key,
                'bucket' => $sdkConfig['bucket'] ?? '',
                'error' => $exception->getMessage(),
            ]);

            throw new CloudFileException(
                'OSS STS simple upload failed: ' . $exception->getMessage(),
                0,
                $exception
            );
        }
    }

    /**
     * Convert credential to OSS SDK configuration format.
     */
    private function convertCredentialToSdkConfig(array $credential): array
    {
        if (! isset($credential['temporary_credential'])) {
            throw new CloudFileException('Missing temporary_credential in credential');
        }

        $tempCredential = $credential['temporary_credential'];

        // Build endpoint from region
        $region = $tempCredential['region'];
        $endpoint = "https://{$region}.aliyuncs.com";

        return [
            'endpoint' => $endpoint,
            'accessKeyId' => $tempCredential['access_key_id'],
            'accessKeySecret' => $tempCredential['access_key_secret'],
            'securityToken' => $tempCredential['sts_token'],
            'bucket' => $tempCredential['bucket'],
            'dir' => $tempCredential['dir'],
            'region' => str_replace('oss-', '', $region), // Remove 'oss-' prefix, oss-ap-southeast-1 -> ap-southeast-1
        ];
    }

    /**
     * Create OSS client - using OSS SDK v2 approach.
     */
    private function createOssClient(array $config): OssClient
    {
        $endpoint = $config['endpoint'];
        $accessKeyId = $config['accessKeyId'];
        $accessKeySecret = $config['accessKeySecret'];
        $securityToken = $config['securityToken'] ?? null;
        $region = $config['region'] ?? 'cn-hangzhou';

        // Use StaticCredentialsProvider to create credential provider (supports STS)
        $provider = new StaticCredentialsProvider($accessKeyId, $accessKeySecret, $securityToken);

        // OSS SDK v2 configuration
        $ossConfig = [
            'provider' => $provider,
            'endpoint' => $endpoint,
            'signatureVersion' => OssClient::OSS_SIGNATURE_VERSION_V4,
            'region' => $region,
        ];

        return new OssClient($ossConfig);
    }

    private function aliyunCalcStringToSign($method, $date, array $headers, $resourcePath, array $query): string
    {
        /*
        SignToString =
            VERB + "\n"
            + Content-MD5 + "\n"
            + Content-Type + "\n"
            + Date + "\n"
            + CanonicalizedOSSHeaders
            + CanonicalizedResource
        Signature = base64(hmac-sha1(AccessKeySecret, SignToString))
        */
        $contentMd5 = '';
        $contentType = '';
        // CanonicalizedOSSHeaders
        $signheaders = [];
        foreach ($headers as $key => $value) {
            $lowk = strtolower($key);
            if (strncmp($lowk, 'x-oss-', 6) == 0) {
                $signheaders[$lowk] = $value;
            } elseif ($lowk === 'content-md5') {
                $contentMd5 = $value;
            } elseif ($lowk === 'content-type') {
                $contentType = $value;
            }
        }
        ksort($signheaders);
        $canonicalizedOSSHeaders = '';
        foreach ($signheaders as $key => $value) {
            $canonicalizedOSSHeaders .= $key . ':' . $value . "\n";
        }
        // CanonicalizedResource
        $signquery = [];
        foreach ($query as $key => $value) {
            if (in_array($key, $this->signKeyList)) {
                $signquery[$key] = $value;
            }
        }
        ksort($signquery);
        $sortedQueryList = [];
        foreach ($signquery as $key => $value) {
            if (strlen($value) > 0) {
                $sortedQueryList[] = $key . '=' . $value;
            } else {
                $sortedQueryList[] = $key;
            }
        }
        $queryStringSorted = implode('&', $sortedQueryList);
        $canonicalizedResource = $resourcePath;
        if (! empty($queryStringSorted)) {
            $canonicalizedResource .= '?' . $queryStringSorted;
        }
        return $method . "\n" . $contentMd5 . "\n" . $contentType . "\n" . $date . "\n" . $canonicalizedOSSHeaders . $canonicalizedResource;
    }
}
