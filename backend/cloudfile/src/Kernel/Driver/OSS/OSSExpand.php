<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Driver\OSS;

use AlibabaCloud\Client\AlibabaCloud;
use AlibabaCloud\Sts\Sts;
use DateTime;
use Dtyq\CloudFile\Kernel\Driver\ExpandInterface;
use Dtyq\CloudFile\Kernel\Exceptions\ChunkDownloadException;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\ChunkDownloadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkDownloadFile;
use Dtyq\CloudFile\Kernel\Struct\ChunkDownloadInfo;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\FileMetadata;
use Dtyq\CloudFile\Kernel\Utils\EasyFileTools;
use Exception;
use InvalidArgumentException;
use League\Flysystem\FileAttributes;
use OSS\Core\OssException;
use OSS\Credentials\StaticCredentialsProvider;
use OSS\OssClient;

class OSSExpand implements ExpandInterface
{
    private array $config;

    private OssClient $client;

    private string $bucket;

    public function __construct(array $config = [])
    {
        $this->config = $config;

        $this->bucket = $config['bucket'];
        if (! empty($config['securityToken'])) {
            $this->client = $this->createSTSClient($config);
        } else {
            $this->client = $this->createClient($config);
        }
    }

    public function getUploadCredential(CredentialPolicy $credentialPolicy, array $options = []): array
    {
        return $credentialPolicy->isSts() ? $this->getUploadCredentialBySts($credentialPolicy) : $this->getUploadCredentialBySimple($credentialPolicy);
    }

    public function getPreSignedUrls(array $fileNames, int $expires = 3600, array $options = []): array
    {
        return [];
    }

    public function getFileLinks(array $paths, array $downloadNames = [], int $expires = 3600, array $options = []): array
    {
        $list = [];
        foreach ($paths as $path) {
            $downloadName = $downloadNames[$path] ?? '';
            $url = $this->signUrl($path, $expires, $downloadName, $options);
            $list[$path] = new FileLink($path, $url, $expires, $downloadName);
        }
        return $list;
    }

    /**
     * @phpstan-ignore-next-line (FileAttributes is compatible with expected return type)
     */
    public function getMetas(array $paths, array $options = []): array
    {
        $list = [];
        foreach ($paths as $path) {
            $list[$path] = $this->getMeta($path);
        }
        return $list;
    }

    public function destroy(array $paths, array $options = []): void
    {
        foreach ($paths as $path) {
            $this->client->deleteObject($this->bucket, $path);
        }
    }

    public function duplicate(string $source, string $destination, array $options = []): string
    {
        $this->client->copyObject($this->bucket, $source, $this->bucket, $destination);
        return $destination;
    }

    public function downloadByChunks(string $filePath, string $localPath, ChunkDownloadConfig $config, array $options = []): void
    {
        try {
            // Get file metadata first with detailed error handling
            try {
                $objectMeta = $this->client->getObjectMeta($this->bucket, $filePath);
                $fileSize = (int) ($objectMeta['content-length'] ?? 0);
            } catch (OssException $e) {
                throw ChunkDownloadException::createGetFileInfoFailed(
                    'OSS getObjectMeta failed: ' . $e->getMessage() . ' (Code: ' . $e->getErrorCode() . ')',
                    $filePath,
                    $e
                );
            }

            if ($fileSize === 0) {
                throw ChunkDownloadException::createGetFileInfoFailed("File is empty or does not exist: {$filePath}", $filePath);
            }

            // Create chunk download file object
            $downloadFile = new ChunkDownloadFile($filePath, $localPath, $fileSize, $config);

            // Check if should use chunk download
            if (! $downloadFile->shouldUseChunkDownload()) {
                $this->downloadFileDirectly($filePath, $localPath);
                return;
            }

            // Calculate chunks
            $downloadFile->calculateChunks();
            $chunks = $downloadFile->getChunks();

            // Create chunks directory for temporary files
            $chunksDir = $downloadFile->createChunksDirectory();

            try {
                // Download chunks with concurrency control
                $this->downloadChunksConcurrently($chunks, $config, $options, $filePath);

                // Merge chunks into final file
                $this->mergeChunksToFile($chunks, $localPath);

                // Verify download integrity
                $this->verifyDownloadedFile($localPath, $fileSize);

                // Trigger completion callback
                if ($progressCallback = $downloadFile->getProgressCallback()) {
                    $progressCallback->onComplete();
                }
            } finally {
                // Clean up temporary chunk files
                $downloadFile->cleanupTempFiles();
            }
        } catch (ChunkDownloadException $e) {
            // Re-throw ChunkDownloadException as-is
            throw $e;
        } catch (Exception $e) {
            throw ChunkDownloadException::createGetFileInfoFailed($e->getMessage(), $filePath, $e);
        }
    }

    /**
     * Download file directly without chunking (for small files)
     * Using OSS SDK's native OSS_FILE_DOWNLOAD option for maximum efficiency.
     */
    private function downloadFileDirectly(string $filePath, string $localPath): void
    {
        try {
            // Use OSS SDK's native file download option for maximum efficiency
            // This automatically handles streaming and memory optimization
            $options = [
                OssClient::OSS_FILE_DOWNLOAD => $localPath,
            ];

            $this->client->getObject($this->bucket, $filePath, $options);
        } catch (OssException $e) {
            throw ChunkDownloadException::createTempFileOperationFailed(
                'OSS direct download failed: ' . $e->getMessage(),
                $localPath
            );
        } catch (Exception $e) {
            throw ChunkDownloadException::createTempFileOperationFailed(
                'Failed to download file directly: ' . $e->getMessage(),
                $localPath
            );
        }
    }

    /**
     * Download chunks with concurrency control.
     */
    private function downloadChunksConcurrently(array $chunks, ChunkDownloadConfig $config, array $options, string $filePath): void
    {
        $maxConcurrency = $config->getMaxConcurrency();
        $activeDownloads = [];
        $completedChunks = 0;
        $totalChunks = count($chunks);

        foreach ($chunks as $chunk) {
            // Control concurrency
            while (count($activeDownloads) >= $maxConcurrency) {
                // Wait for any download to complete
                $this->waitForAnyDownloadToComplete($activeDownloads);
            }

            // Start new download
            $activeDownloads[] = $this->startChunkDownload($chunk, $config, $options, $filePath);
        }

        // Wait for all remaining downloads to complete
        while (! empty($activeDownloads)) {
            $this->waitForAnyDownloadToComplete($activeDownloads);
        }
    }

    /**
     * Start downloading a single chunk.
     */
    private function startChunkDownload(ChunkDownloadInfo $chunk, ChunkDownloadConfig $config, array $options, string $filePath): array
    {
        $maxRetries = $config->getMaxRetries();
        $retryDelay = $config->getRetryDelay();

        for ($attempt = 1; $attempt <= $maxRetries; ++$attempt) {
            try {
                $this->downloadSingleChunk($chunk, $filePath);
                $chunk->setDownloaded(true);

                return [
                    'chunk' => $chunk,
                    'status' => 'completed',
                    'attempt' => $attempt,
                ];
            } catch (Exception $e) {
                $chunk->incrementRetryCount();
                $chunk->setLastError($e);

                if ($attempt >= $maxRetries) {
                    $errorMsg = "分片 {$chunk->getPartNumber()} 下载失败，已重试 {$maxRetries} 次。最后错误: " . $e->getMessage();
                    throw ChunkDownloadException::createRetryExhausted(
                        $errorMsg,
                        $chunk->getPartNumber(),
                        $maxRetries,
                        $e->getMessage()
                    );
                }

                // Exponential backoff with jitter
                $delay = $retryDelay * (2 ** ($attempt - 1));
                $jitter = rand(0, min(1000, $delay / 10));
                $totalDelay = ($delay + $jitter) / 1000; // Convert to seconds

                usleep(($delay + $jitter) * 1000);
            }
        }

        // This should never be reached due to exception throwing in final attempt
        throw ChunkDownloadException::createRetryExhausted(
            '分片下载重试耗尽',
            $chunk->getPartNumber(),
            $maxRetries,
            '未知错误'
        );
    }

    /**
     * Download a single chunk using OSS SDK's native Range download with direct file output.
     */
    private function downloadSingleChunk(ChunkDownloadInfo $chunk, string $filePath): void
    {
        try {
            // 根据官方文档，Range格式应该是 '0-4' 而不是 'bytes=0-4'
            $rangeHeader = sprintf('%d-%d', $chunk->getStart(), $chunk->getEnd());

            // 使用官方文档标准的Range下载方式
            $options = [
                OssClient::OSS_RANGE => $rangeHeader,
            ];

            // 获取Range内容到内存
            $content = $this->client->getObject($this->bucket, $filePath, $options);

            // 写入到临时文件
            $bytesWritten = file_put_contents($chunk->getTempFilePath(), $content);
            if ($bytesWritten === false) {
                throw ChunkDownloadException::createTempFileOperationFailed(
                    'Failed to write chunk content to temp file',
                    $chunk->getTempFilePath()
                );
            }

            // Verify downloaded file size
            $downloadedBytes = filesize($chunk->getTempFilePath());
            if ($downloadedBytes === false) {
                throw ChunkDownloadException::createTempFileOperationFailed(
                    'Cannot get downloaded chunk file size',
                    $chunk->getTempFilePath()
                );
            }

            // Verify chunk size
            if ($downloadedBytes !== $chunk->getSize()) {
                throw ChunkDownloadException::createVerificationFailed(
                    "Chunk size mismatch. Expected: {$chunk->getSize()}, actual: {$downloadedBytes}",
                    '',
                    ''
                );
            }

            $chunk->setDownloadedBytes($downloadedBytes);
        } catch (OssException $e) {
            throw ChunkDownloadException::createTempFileOperationFailed(
                'OSS chunk download failed: ' . $e->getMessage(),
                $chunk->getTempFilePath()
            );
        } catch (Exception $e) {
            throw ChunkDownloadException::createTempFileOperationFailed(
                'Failed to download chunk: ' . $e->getMessage(),
                $chunk->getTempFilePath()
            );
        }
    }

    /**
     * Wait for any download to complete (simplified implementation).
     */
    private function waitForAnyDownloadToComplete(array &$activeDownloads): void
    {
        // Simple implementation: just remove the first completed download
        // In a real implementation, you might use async processing
        if (! empty($activeDownloads)) {
            array_shift($activeDownloads);
        }

        // Small delay to prevent busy waiting
        usleep(10000); // 10ms
    }

    /**
     * Merge chunks into final file using streaming approach.
     */
    private function mergeChunksToFile(array $chunks, string $outputPath): void
    {
        $outputFile = fopen($outputPath, 'wb');
        if (! $outputFile) {
            throw ChunkDownloadException::createTempFileOperationFailed("Cannot create output file: {$outputPath}", '');
        }

        try {
            // Sort chunks by part number to ensure correct order
            usort($chunks, function ($a, $b) {
                return $a->getPartNumber() <=> $b->getPartNumber();
            });

            foreach ($chunks as $chunk) {
                if (! $chunk->isDownloaded()) {
                    throw ChunkDownloadException::createVerificationFailed(
                        "Chunk {$chunk->getPartNumber()} was not downloaded successfully",
                        '',
                        ''
                    );
                }

                $chunkFile = fopen($chunk->getTempFilePath(), 'rb');
                if (! $chunkFile) {
                    throw ChunkDownloadException::createTempFileOperationFailed(
                        "Cannot read chunk file: {$chunk->getTempFilePath()}",
                        ''
                    );
                }

                try {
                    // Stream copy chunk content to output file
                    while (! feof($chunkFile)) {
                        $buffer = fread($chunkFile, 8192);
                        if ($buffer !== false) {
                            fwrite($outputFile, $buffer);
                        }
                    }
                } finally {
                    fclose($chunkFile);
                }
            }
        } finally {
            fclose($outputFile);
        }
    }

    /**
     * Verify downloaded file integrity.
     */
    private function verifyDownloadedFile(string $filePath, int $expectedSize): void
    {
        if (! file_exists($filePath)) {
            throw ChunkDownloadException::createVerificationFailed("Downloaded file not found: {$filePath}", '', '');
        }

        $actualSize = filesize($filePath);
        if ($actualSize !== $expectedSize) {
            throw ChunkDownloadException::createVerificationFailed("File size mismatch. Expected: {$expectedSize}, actual: {$actualSize}", '', '');
        }
    }

    /**
     * @see https://www.alibabacloud.com/help/zh/oss/developer-reference/getobjectmeta
     */
    private function getMeta(string $path): FileMetadata
    {
        $data = $this->client->getObjectMeta($this->bucket, $path);
        $fileName = basename($path);

        return new FileMetadata(
            $fileName,
            $path,
            new FileAttributes(
                $path,
                (int) ($data['content-length'] ?? 0),
                null,
                (int) (new DateTime($data['last-modified']))->getTimestamp(),
                $data['content-type'] ?? null
            )
        );
    }

    private function signUrl(string $path, int $timeout = 60, string $downloadName = '', array $options = []): string
    {
        if (! empty($downloadName)) {
            $options['response-content-disposition'] = 'attachment;filename="' . $downloadName . '"';
        }
        // 如果是图片，做图片处理
        if (EasyFileTools::isImage($path) && ! empty($options['image']['process'])) {
            $options['x-oss-process'] = $options['image']['process'];
        }
        $path = ltrim($path, '/');
        $url = $this->client->signUrl($this->bucket, $path, $timeout, OssClient::OSS_HTTP_GET, $options);

        if (! empty($this->config['cdn'])) {
            $urlParse = parse_url($url);
            $url = "{$this->config['cdn']}{$urlParse['path']}?{$urlParse['query']}";
        }

        return $url;
    }

    /**
     * @see https://help.aliyun.com/zh/oss/use-cases/obtain-signature-information-from-the-server-and-upload-data-to-oss
     */
    private function getUploadCredentialBySimple(CredentialPolicy $credentialPolicy): array
    {
        $expires = $credentialPolicy->getExpires();

        $now = new DateTime();
        $end = $now->modify("+{$expires} seconds");

        $expiration = $this->gmtIso8601($end);

        $conditions = [
            ['bucket' => $this->config['bucket']],
        ];
        if (! empty($credentialPolicy->getSizeMax())) {
            $conditions[] = ['content-length-range', 0, $credentialPolicy->getSizeMax()];
        }
        if (! empty($credentialPolicy->getDir())) {
            $conditions[] = ['starts-with', '$key', $credentialPolicy->getDir()];
        }
        if (! empty($credentialPolicy->getMimeType())) {
            $conditions[] = ['in', '$content-type', $credentialPolicy->getMimeType()];
        }

        $base64policy = base64_encode(json_encode(['expiration' => $expiration, 'conditions' => $conditions]));
        $signature = base64_encode(hash_hmac('sha1', $base64policy, $this->config['accessSecret'], true));

        $endpointParse = parse_url($this->config['endpoint']);
        $host = "{$endpointParse['scheme']}://{$this->config['bucket']}.{$endpointParse['host']}";

        return [
            'accessid' => $this->config['accessId'],
            'host' => $host,
            'policy' => $base64policy,
            'signature' => $signature,
            'expires' => $end->getTimestamp(),
            'dir' => $credentialPolicy->getDir(),
            'callback' => '', // 取消回调
        ];
    }

    /**
     * @see https://help.aliyun.com/zh/oss/developer-reference/use-temporary-access-credentials-provided-by-sts-to-access-oss?spm=a2c4g.11186623.0.i4#concept-xzh-nzk-2gb
     */
    private function getUploadCredentialBySts(CredentialPolicy $credentialPolicy): array
    {
        $roleSessionName = $credentialPolicy->getRoleSessionName() ?: uniqid('easy_file_');
        $roleArn = $this->config['role_arn'] ?? '';
        if (empty($roleArn)) {
            throw new CloudFileException('未配置role_arn');
        }

        // 目前的过期时间限制为 900~3600
        $expires = max(900, min(3600, $credentialPolicy->getExpires()));

        // 通过endpoint获取region
        $region = explode('.', parse_url($this->config['endpoint'])['host'])[0];

        AlibabaCloud::accessKeyClient($this->config['accessId'], $this->config['accessSecret'])->regionId(ltrim($region, 'oss-'))->asDefaultClient();

        // 目录限制
        $resource = "{$this->config['bucket']}/";
        if (! empty($credentialPolicy->getDir())) {
            $resource = $resource . $credentialPolicy->getDir();
        }

        // 限制上传策略
        $stsPolicy = [
            'Statement' => [
                [
                    'Action' => [
                        'oss:PutObject',
                        'oss:AbortMultipartUpload',
                        'oss:GetObject',
                        'oss:ListParts',
                        'oss:GetObjectMeta',
                    ],
                    'Resource' => [
                        "acs:oss:*:*:{$resource}*",
                    ],
                    'Effect' => 'Allow',
                ],
            ],
        ];

        $sts = Sts::v20150401()->assumeRole([
            'query' => [
                'RegionId' => 'cn-shenzhen',
                'RoleArn' => $this->config['role_arn'],
                'RoleSessionName' => $roleSessionName,
                'DurationSeconds' => $expires,
                'Policy' => json_encode($stsPolicy),
            ],
        ])->request()->toArray();

        return [
            'region' => $region,
            'access_key_id' => $sts['Credentials']['AccessKeyId'],
            'access_key_secret' => $sts['Credentials']['AccessKeySecret'],
            'sts_token' => $sts['Credentials']['SecurityToken'],
            'bucket' => $this->config['bucket'],
            'dir' => $credentialPolicy->getDir(),
            'expires' => $expires,
            'callback' => '',
        ];
    }

    private function gmtIso8601(DateTime $time): string
    {
        $dStr = $time->format('Y-m-d H:i:s');
        $expiration = str_replace(' ', 'T', $dStr);
        return $expiration . '.000Z';
    }

    private function createClient(array $config): OssClient
    {
        $accessId = $config['accessId'];
        $accessSecret = $config['accessSecret'];
        $endpoint = $config['endpoint'] ?? 'oss-cn-hangzhou.aliyuncs.com';
        $timeout = $config['timeout'] ?? 3600;
        $connectTimeout = $config['connectTimeout'] ?? 10;
        $isCName = $config['isCName'] ?? false;
        $token = $config['token'] ?? null;
        $proxy = $config['proxy'] ?? null;

        $client = new OssClient(
            $accessId,
            $accessSecret,
            $endpoint,
            $isCName,
            $token,
            $proxy,
        );

        $client->setTimeout($timeout);
        $client->setConnectTimeout($connectTimeout);
        return $client;
    }

    /**
     * Create OSS client with STS token (StaticCredentialsProvider + V4 signature)
     * This method assumes STS token is always provided for business logic requirements.
     */
    private function createSTSClient(array $config): OssClient
    {
        $accessId = $config['accessId'];
        $accessSecret = $config['accessSecret'];
        $endpoint = $config['endpoint'] ?? 'oss-cn-hangzhou.aliyuncs.com';
        $timeout = $config['timeout'] ?? 3600;
        $connectTimeout = $config['connectTimeout'] ?? 10;

        // STS token is required - Priority: token > sts_token > stsToken
        $stsToken = $config['securityToken'] ?? null;

        if (empty($stsToken)) {
            throw new InvalidArgumentException('STS token is required but not provided in config');
        }

        // Create StaticCredentialsProvider for STS token authentication
        $provider = new StaticCredentialsProvider($accessId, $accessSecret, $stsToken);

        // Extract region from endpoint for v4 signature
        $region = $this->extractRegionFromEndpoint($endpoint);

        $clientConfig = [
            'provider' => $provider,
            'endpoint' => $endpoint,
            'signatureVersion' => OssClient::OSS_SIGNATURE_VERSION_V4,
            'region' => $region,
        ];

        $client = new OssClient($clientConfig);
        $client->setTimeout($timeout);
        $client->setConnectTimeout($connectTimeout);

        return $client;
    }

    /**
     * Extract region from OSS endpoint.
     */
    private function extractRegionFromEndpoint(string $endpoint): string
    {
        // Parse endpoint to extract region
        // e.g., https://oss-cn-hangzhou.aliyuncs.com -> cn-hangzhou
        $host = parse_url($endpoint, PHP_URL_HOST);
        if (preg_match('/oss-(.+)\.aliyuncs\.com/', $host, $matches)) {
            return $matches[1];
        }

        // Default fallback
        return 'cn-hangzhou';
    }
}
