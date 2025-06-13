<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Driver\TOS;

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
use GuzzleHttp\Psr7\Utils;
use League\Flysystem\FileAttributes;
use Tos\Config\ConfigParser;
use Tos\Model\CopyObjectInput;
use Tos\Model\DeleteObjectInput;
use Tos\Model\Enum;
use Tos\Model\GetObjectInput;
use Tos\Model\HeadObjectInput;
use Tos\Model\PreSignedURLInput;
use Tos\TosClient;
use Volc\Service\Sts;

class TOSExpand implements ExpandInterface
{
    private ConfigParser $configParser;

    private array $config;

    private TosClient $client;

    public function __construct(array $config = [])
    {
        $this->config = $config;
        $this->configParser = new ConfigParser($config);
        $this->client = new TosClient($this->configParser);
    }

    public function getUploadCredential(CredentialPolicy $credentialPolicy, array $options = []): array
    {
        return $credentialPolicy->isSts() ? $this->getUploadCredentialBySts($credentialPolicy) : $this->getUploadCredentialBySimple($credentialPolicy);
    }

    public function getPreSignedUrls(array $fileNames, int $expires = 3600, array $options = []): array
    {
        return [];
    }

    /**
     * @phpstan-ignore-next-line
     */
    public function getMetas(array $paths, array $options = []): array
    {
        $list = [];
        foreach ($paths as $path) {
            $list[$path] = $this->getMeta($path);
        }
        return $list;
    }

    public function getFileLinks(array $paths, array $downloadNames = [], int $expires = 3600, array $options = []): array
    {
        $list = [];
        foreach ($paths as $path) {
            $url = $this->getPreSignedUrl($path, $expires, $options);
            $list[$path] = new FileLink($path, $url, $expires, '');
        }
        return $list;
    }

    public function destroy(array $paths, array $options = []): void
    {
        foreach ($paths as $path) {
            $this->client->deleteObject(new DeleteObjectInput($this->getBucket(), $path));
        }
    }

    public function duplicate(string $source, string $destination, array $options = []): string
    {
        $input = new CopyObjectInput($this->getBucket(), $destination, $this->getBucket(), $source);
        // 简易的配置添加方式
        foreach ($options['methods'] ?? [] as $method => $value) {
            if (method_exists($input, $method)) {
                $input->{$method}($value);
            }
        }
        $this->client->copyObject($input);
        return $destination;
    }

    public function downloadByChunks(string $filePath, string $localPath, ChunkDownloadConfig $config, array $options = []): void
    {
        try {
            // Get file metadata first
            $headObjectOutput = $this->client->headObject(new HeadObjectInput($this->getBucket(), $filePath));
            $fileSize = $headObjectOutput->getContentLength();

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
        } catch (Exception $e) {
            throw ChunkDownloadException::createGetFileInfoFailed($e->getMessage(), $filePath, $e);
        }
    }

    /**
     * Download file directly without chunking (for small files)
     * Using TOS SDK recommended approach with Utils::copyToStream().
     */
    private function downloadFileDirectly(string $filePath, string $localPath): void
    {
        $output = null;
        $localFile = null;

        try {
            // Get object using TOS SDK
            $input = new GetObjectInput($this->getBucket(), $filePath);
            $output = $this->client->getObject($input);

            // Open local file for writing
            $localFile = fopen($localPath, 'w');
            if (! $localFile) {
                throw ChunkDownloadException::createTempFileOperationFailed("Cannot create local file: {$localPath}", '');
            }

            // Use SDK recommended streaming approach
            Utils::copyToStream(
                Utils::streamFor($output->getContent()),
                Utils::streamFor($localFile)
            );
        } catch (Exception $e) {
            throw ChunkDownloadException::createTempFileOperationFailed('Failed to download file directly: ' . $e->getMessage(), '');
        } finally {
            // Clean up resources
            if ($output) {
                $output->getContent()->close();
            }
            if (is_resource($localFile)) {
                fclose($localFile);
            }
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
                    throw ChunkDownloadException::createRetryExhausted(
                        '',
                        $chunk->getPartNumber(),
                        $maxRetries,
                        ''
                    );
                }

                // Exponential backoff with jitter
                $delay = $retryDelay * (2 ** ($attempt - 1));
                $jitter = rand(0, min(1000, $delay / 10));
                usleep(($delay + $jitter) * 1000);
            }
        }

        // This should never be reached due to exception throwing in final attempt
        throw ChunkDownloadException::createRetryExhausted(
            '',
            $chunk->getPartNumber(),
            $maxRetries,
            ''
        );
    }

    /**
     * Download a single chunk using HTTP Range request.
     */
    private function downloadSingleChunk(ChunkDownloadInfo $chunk, string $filePath): void
    {
        $input = new GetObjectInput($this->getBucket(), $filePath);

        // Set Range header for partial download
        $input->setRangeStart($chunk->getStart());
        $input->setRangeEnd($chunk->getEnd());

        $output = $this->client->getObject($input);

        $tempFile = fopen($chunk->getTempFilePath(), 'wb');
        if (! $tempFile) {
            throw ChunkDownloadException::createTempFileOperationFailed('Cannot create temp file: ' . $chunk->getTempFilePath(), '');
        }

        try {
            $downloadedBytes = 0;
            while ($buffer = $output->getContent()->read(8192)) {
                $bytesWritten = fwrite($tempFile, $buffer);
                $downloadedBytes += $bytesWritten;
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
        } finally {
            fclose($tempFile);
            $output->getContent()->close();
        }
    }

    /**
     * Wait for any download to complete (simplified implementation).
     */
    private function waitForAnyDownloadToComplete(array &$activeDownloads): void
    {
        // Remove completed downloads
        $activeDownloads = array_filter($activeDownloads, function ($download) {
            return $download['status'] !== 'completed';
        });

        // Simple delay to prevent busy waiting
        usleep(10000); // 10ms
    }

    /**
     * Merge downloaded chunks into final file.
     */
    private function mergeChunksToFile(array $chunks, string $outputPath): void
    {
        $outputFile = fopen($outputPath, 'wb');
        if (! $outputFile) {
            throw ChunkDownloadException::createTempFileOperationFailed("Cannot create output file: {$outputPath}", '');
        }

        try {
            foreach ($chunks as $chunk) {
                if (! $chunk->isDownloaded()) {
                    throw ChunkDownloadException::createMergeFailed("Chunk {$chunk->getPartNumber()} not downloaded", '', '');
                }

                $tempFilePath = $chunk->getTempFilePath();
                if (! file_exists($tempFilePath)) {
                    throw ChunkDownloadException::createTempFileOperationFailed("Temp file not found: {$tempFilePath}", '');
                }

                $chunkFile = fopen($tempFilePath, 'rb');
                if (! $chunkFile) {
                    throw ChunkDownloadException::createTempFileOperationFailed("Cannot read temp file: {$tempFilePath}", '');
                }

                try {
                    while ($buffer = fread($chunkFile, 8192)) {
                        fwrite($outputFile, $buffer);
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

    private function getMeta(string $path): FileMetadata
    {
        $output = $this->client->headObject(new HeadObjectInput($this->getBucket(), $path));
        $fileName = basename($path);

        return new FileMetadata(
            $fileName,
            $path,
            new FileAttributes(
                $path,
                $output->getContentLength(),
                null,
                $output->getLastModified(),
                $output->getContentType()
            )
        );
    }

    /**
     * @see https://www.volcengine.com/docs/6349/156107
     * 最大7天
     */
    private function getPreSignedUrl(string $path, int $expires = 3600, array $options = []): string
    {
        $input = new PreSignedURLInput(Enum::HttpMethodGet, $this->getBucket(), $path);
        $input->setExpires($expires);
        // 图片处理
        if (EasyFileTools::isImage($path) && ! empty($options['image']['process'])) {
            $query = [
                'x-tos-process' => $options['image']['process'],
            ];
            $input->setQuery($query);
        }
        return $this->client->preSignedURL($input)->getSignedUrl();
    }

    private function getUploadCredentialBySimple(CredentialPolicy $credentialPolicy): array
    {
        $expires = $credentialPolicy->getExpires();

        $now = new DateTime();
        $end = $now->modify("+{$expires} seconds");

        $expiration = str_replace(' ', 'T', $end->format('Y-m-d H:i:s')) . '.000Z';
        $serverSideEncryption = 'AES256';
        $algorithm = 'TOS4-HMAC-SHA256';
        $date = $end->format('Ymd\THis\Z');
        $credential = "{$this->configParser->getAk()}/{$end->format('Ymd')}/{$this->configParser->getRegion()}/tos/request";
        $conditions = [
            [
                'bucket' => $this->getBucket(),
            ],
            [
                'x-tos-server-side-encryption' => $serverSideEncryption,
            ],
            [
                'x-tos-credential' => $credential,
            ],
            [
                'x-tos-algorithm' => $algorithm,
            ],
            [
                'x-tos-date' => $date,
            ],
        ];
        $conditions[] = ['starts-with', '$key', $credentialPolicy->getDir()];
        if ($credentialPolicy->getContentType()) {
            $conditions[] = ['starts-with', '$Content-Type', $credentialPolicy->getContentType()];
        }

        $base64policy = base64_encode(json_encode(['expiration' => $expiration, 'conditions' => $conditions]));

        $dateKey = hash_hmac('sha256', $end->format('Ymd'), $this->configParser->getSk(), true);
        $regionKey = hash_hmac('sha256', $this->configParser->getRegion(), $dateKey, true);
        $serviceKey = hash_hmac('sha256', 'tos', $regionKey, true);
        $signingKey = hash_hmac('sha256', 'request', $serviceKey, true);
        $signature = hash_hmac('sha256', $base64policy, $signingKey);

        $callback = '';

        return [
            'host' => $this->configParser->getEndpoint($this->getBucket()),
            'x-tos-algorithm' => $algorithm,
            'x-tos-date' => $date,
            'x-tos-credential' => $credential,
            'x-tos-signature' => $signature,
            'x-tos-server-side-encryption' => $serverSideEncryption,
            'policy' => $base64policy,
            'expires' => $end->getTimestamp(),
            'dir' => $credentialPolicy->getDir(),
            'content_type' => $credentialPolicy->getContentType(),
            'x-tos-callback' => $callback,
        ];
    }

    /**
     * @see https://www.volcengine.com/docs/6349/127695
     */
    private function getUploadCredentialBySts(CredentialPolicy $credentialPolicy): array
    {
        if (empty($this->getTrn())) {
            throw new CloudFileException('未配置 trn');
        }
        $roleSessionName = $credentialPolicy->getRoleSessionName() ?: uniqid('easy_file_');

        $expires = $credentialPolicy->getExpires();

        // 目录限制
        $resource = "{$this->getBucket()}/";
        if (! empty($credentialPolicy->getDir())) {
            $resource = $resource . $credentialPolicy->getDir();
        }

        // 限制上传策略
        $stsPolicy = [
            'Statement' => [
                [
                    'Action' => [
                        'tos:PutObject',
                        'tos:GetObject',
                        'tos:AbortMultipartUpload',
                        'tos:ListMultipartUploadParts',
                        'tos:GetObjectVersion',
                    ],
                    'Resource' => [
                        "trn:tos:::{$resource}*",
                    ],
                    'Effect' => 'Allow',
                ],
            ],
        ];

        $query = [
            'query' => [
                'DurationSeconds' => $expires,
                'RoleSessionName' => $roleSessionName,
                'RoleTrn' => $this->getTrn(),
                'Policy' => json_encode($stsPolicy),
            ],
        ];

        $callback = '';

        $client = Sts::getInstance();
        $client->setAccessKey($this->configParser->getAk());
        $client->setSecretKey($this->configParser->getSk());
        $body = $client->assumeRole($query)->getContents();
        $data = json_decode($body, true);
        if (empty($data['Result']['Credentials'])) {
            throw new CloudFileException('获取 STS 失败');
        }

        return [
            'host' => $this->configParser->getEndpoint($this->getBucket()),
            'region' => $this->configParser->getRegion(),
            'endpoint' => $this->configParser->getEndpoint(),
            'credentials' => $data['Result']['Credentials'],
            'bucket' => $this->getBucket(),
            'dir' => $credentialPolicy->getDir() ?? '',
            'expires' => $expires,
            'callback' => $callback,
        ];
    }

    private function getBucket(): string
    {
        return $this->config['bucket'] ?? '';
    }

    private function getTrn(): string
    {
        return $this->config['trn'] ?? '';
    }
}
