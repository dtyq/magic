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
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload;
use Throwable;
use Tos\Exception\TosClientException;
use Tos\Exception\TosServerException;
use Tos\Model\AbortMultipartUploadInput;
use Tos\Model\CompleteMultipartUploadInput;
use Tos\Model\CreateMultipartUploadInput;
use Tos\Model\PutObjectInput;
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
