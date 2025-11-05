<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Driver\S3;

use Aws\S3\S3Client;
use Aws\Sts\StsClient;
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
use Exception;
use GuzzleHttp\Psr7\Utils;
use Throwable;

class S3Expand implements ExpandInterface
{
    private array $config;

    private S3Client $client;

    public function __construct(array $config = [])
    {
        $this->config = $config;
        $this->client = new S3Client([
            'version' => $config['version'] ?? 'latest',
            'region' => $config['region'] ?? 'us-east-1',
            'endpoint' => $config['endpoint'] ?? null,
            'use_path_style_endpoint' => $config['use_path_style_endpoint'] ?? true,
            'credentials' => [
                'key' => $config['accessKey'] ?? '',
                'secret' => $config['secretKey'] ?? '',
            ],
        ]);
    }

    public function getUploadCredential(CredentialPolicy $credentialPolicy, array $options = []): array
    {
        // return $credentialPolicy->isSts() ? $this->getUploadCredentialBySts($credentialPolicy) : $this->getUploadCredentialBySimple($credentialPolicy);
        // s3 暂支持 sts 的方式
        return $this->getUploadCredentialBySts($credentialPolicy);
    }

    public function getPreSignedUrls(array $fileNames, int $expires = 3600, array $options = []): array
    {
        return [];
    }

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
            $downloadName = $downloadNames[$path] ?? '';
            $params = [
                'Bucket' => $this->getBucket(),
                'Key' => $path,
            ];

            if ($downloadName) {
                $params['ResponseContentDisposition'] = "attachment; filename=\"{$downloadName}\"";
            }

            $url = $this->getPreSignedUrl($path, $expires, $params);
            $list[$path] = new FileLink($path, $url, $expires, $downloadName);
        }
        return $list;
    }

    public function destroy(array $paths, array $options = []): void
    {
        foreach ($paths as $path) {
            $this->client->deleteObject([
                'Bucket' => $this->getBucket(),
                'Key' => $path,
            ]);
        }
    }

    public function duplicate(string $source, string $destination, array $options = []): string
    {
        $this->client->copyObject([
            'Bucket' => $this->getBucket(),
            'Key' => $destination,
            'CopySource' => "{$this->getBucket()}/{$source}",
        ]);
        return $destination;
    }

    public function downloadByChunks(string $filePath, string $localPath, ChunkDownloadConfig $config, array $options = []): void
    {
        try {
            // Get file metadata first
            $headResult = $this->client->headObject([
                'Bucket' => $this->getBucket(),
                'Key' => $filePath,
            ]);
            $fileSize = $headResult['ContentLength'];

            // Create chunk download file object
            $downloadFile = new ChunkDownloadFile($filePath, $localPath, $fileSize, $config);

            // Check if you should use chunk download
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
                $this->mergeChunksToFile($chunks, $localPath, $filePath);

                // Verify download integrity
                $this->verifyDownloadedFile($localPath, $fileSize, $filePath);

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
     * Get upload credential using simple signature (PostObject).
     */
    private function getUploadCredentialBySimple(CredentialPolicy $credentialPolicy): array
    {
        $expires = $credentialPolicy->getExpires();

        $now = new DateTime();
        $end = $now->modify("+{$expires} seconds");

        $expiration = $end->format('Y-m-d\TH:i:s\Z');

        $conditions = [
            ['bucket' => $this->getBucket()],
            ['acl' => 'public-read'],
        ];

        if (! empty($credentialPolicy->getSizeMax())) {
            $conditions[] = ['content-length-range', 0, $credentialPolicy->getSizeMax()];
        }
        if (! empty($credentialPolicy->getDir())) {
            $conditions[] = ['starts-with', '$key', $credentialPolicy->getDir()];
        }
        if (! empty($credentialPolicy->getMimeType())) {
            $conditions[] = ['starts-with', '$Content-Type', ''];
        }

        $policy = [
            'expiration' => $expiration,
            'conditions' => $conditions,
        ];

        $base64Policy = base64_encode(json_encode($policy));
        $signature = base64_encode(hash_hmac('sha1', $base64Policy, $this->config['secretKey'], true));

        $endpoint = $this->config['endpoint'] ?? '';
        $host = rtrim($endpoint, '/');

        return [
            'access_key_id' => $this->config['accessKey'],
            'host' => $host,
            'policy' => $base64Policy,
            'signature' => $signature,
            'expires' => $end->getTimestamp(),
            'dir' => $credentialPolicy->getDir(),
            'bucket' => $this->getBucket(),
            'region' => $this->config['region'] ?? 'us-east-1',
            'callback' => '',
        ];
    }

    /**
     * Get upload credential using STS (Security Token Service).
     *
     * @see https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
     */
    private function getUploadCredentialBySts(CredentialPolicy $credentialPolicy): array
    {
        $roleSessionName = $credentialPolicy->getRoleSessionName() ?: uniqid('cloudfile_');
        $roleArn = $this->config['role_arn'] ?? '';
        if (empty($roleArn)) {
            throw new CloudFileException('未配置role_arn');
        }

        // Expires between 900~43200 seconds for AssumeRole
        $expires = max(900, min(43200, $credentialPolicy->getExpires()));

        // Create STS client
        $stsClient = new StsClient([
            'version' => 'latest',
            'region' => $this->config['region'] ?? 'us-east-1',
            'endpoint' => $this->config['sts_endpoint'] ?? null,
            'credentials' => [
                'key' => $this->config['accessKey'] ?? '',
                'secret' => $this->config['secretKey'] ?? '',
            ],
        ]);

        // Build policy based on sts type
        $dir = $credentialPolicy->getDir();
        $resource = "arn:aws:s3:::{$this->getBucket()}";
        if (! empty($dir)) {
            $resource = "{$resource}/{$dir}*";
        }

        $stsPolicy = match ($credentialPolicy->getStsType()) {
            'list_objects' => [
                'Version' => '2012-10-17',
                'Statement' => [
                    [
                        'Effect' => 'Allow',
                        'Action' => [
                            's3:ListBucket',
                            's3:ListBucketVersions',
                        ],
                        'Resource' => "arn:aws:s3:::{$this->getBucket()}",
                        'Condition' => [
                            'StringLike' => [
                                's3:prefix' => [
                                    "{$dir}",
                                    "{$dir}*",
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            'del_objects' => [
                'Version' => '2012-10-17',
                'Statement' => [
                    [
                        'Effect' => 'Allow',
                        'Action' => [
                            's3:DeleteObject',
                            's3:DeleteObjectVersion',
                        ],
                        'Resource' => $resource,
                    ],
                ],
            ],
            default => [
                'Version' => '2012-10-17',
                'Statement' => [
                    [
                        'Effect' => 'Allow',
                        'Action' => [
                            's3:PutObject',
                            's3:GetObject',
                            's3:AbortMultipartUpload',
                            's3:ListMultipartUploadParts',
                            's3:GetObjectVersion',
                        ],
                        'Resource' => $resource,
                    ],
                ],
            ],
        };

        $result = $stsClient->assumeRole([
            'RoleArn' => $roleArn,
            'RoleSessionName' => $roleSessionName,
            'DurationSeconds' => $expires,
            'Policy' => json_encode($stsPolicy),
        ]);

        $credentials = $result['Credentials'];

        return [
            'region' => $this->config['region'] ?? 'us-east-1',
            'credentials' => [
                'access_key_id' => $credentials['AccessKeyId'],
                'access_key_secret' => $credentials['SecretAccessKey'],
                'session_token' => $credentials['SessionToken'],
                'expiration' => $credentials['Expiration'],
            ],
            'bucket' => $this->getBucket(),
            'dir' => $credentialPolicy->getDir(),
            'expires' => $expires,
            'callback' => '',
        ];
    }

    private function getPreSignedUrl(string $path, int $expires = 3600, array $params = []): string
    {
        $defaultParams = [
            'Bucket' => $this->getBucket(),
            'Key' => $path,
        ];

        $command = $this->client->getCommand('GetObject', array_merge($defaultParams, $params));
        $request = $this->client->createPresignedRequest($command, "+{$expires} seconds");

        return (string) $request->getUri();
    }

    private function getMeta(string $path): FileMetadata
    {
        try {
            $result = $this->client->headObject([
                'Bucket' => $this->getBucket(),
                'Key' => $path,
            ]);

            return new FileMetadata(
                $path,
                $result['ContentLength'] ?? '',
                $result['ContentType'] ?? '',
                strtotime($result['LastModified'] ?? 'now'),
                $result['ETag'] ?? ''
            );
        } catch (Throwable $throwable) {
            throw new CloudFileException("Failed to get meta for {$path}: " . $throwable->getMessage());
        }
    }

    private function downloadFileDirectly(string $filePath, string $localPath): void
    {
        try {
            $result = $this->client->getObject([
                'Bucket' => $this->getBucket(),
                'Key' => $filePath,
            ]);

            $localFile = fopen($localPath, 'w');
            if (! $localFile) {
                throw ChunkDownloadException::createTempFileOperationFailed("Cannot create local file: {$localPath}", '');
            }

            Utils::copyToStream(
                $result['Body'],
                Utils::streamFor($localFile)
            );

            fclose($localFile);
        } catch (Exception $e) {
            throw ChunkDownloadException::createTempFileOperationFailed('Failed to download file directly: ' . $e->getMessage(), '');
        }
    }

    private function downloadChunksConcurrently(array $chunks, ChunkDownloadConfig $config, array $options, string $filePath): void
    {
        $maxConcurrency = $config->getMaxConcurrency();
        $activeDownloads = [];
        $completedChunks = 0;
        $totalChunks = count($chunks);

        foreach ($chunks as $chunk) {
            // Control concurrency
            while (count($activeDownloads) >= $maxConcurrency) {
                usleep(10000); // 10ms
                $activeDownloads = array_filter($activeDownloads, fn ($download) => ! $download['completed']);
            }

            // Download chunk
            $this->downloadChunk($chunk, $filePath);
            $activeDownloads[] = ['completed' => true];
            ++$completedChunks;
        }
    }

    private function downloadChunk(ChunkDownloadInfo $chunk, string $filePath): void
    {
        try {
            $result = $this->client->getObject([
                'Bucket' => $this->getBucket(),
                'Key' => $filePath,
                'Range' => "bytes={$chunk->getStart()}-{$chunk->getEnd()}",
            ]);

            file_put_contents($chunk->getTempFilePath(), $result['Body']);
        } catch (Exception $e) {
            throw ChunkDownloadException::createPartDownloadFailed(
                $e->getMessage(),
                '',
                $chunk->getPartNumber(),
                $filePath,
                $e
            );
        }
    }

    private function mergeChunksToFile(array $chunks, string $localPath, string $filePath): void
    {
        $outputFile = fopen($localPath, 'w');
        if (! $outputFile) {
            throw ChunkDownloadException::createMergeFailed(
                "Cannot create output file: {$localPath}",
                '',
                $filePath,
                null
            );
        }

        try {
            foreach ($chunks as $chunk) {
                $chunkData = file_get_contents($chunk->getTempFilePath());
                fwrite($outputFile, $chunkData);
            }
        } finally {
            fclose($outputFile);
        }
    }

    private function verifyDownloadedFile(string $localPath, int $expectedSize, string $filePath): void
    {
        $actualSize = filesize($localPath);
        if ($actualSize !== $expectedSize) {
            throw ChunkDownloadException::createVerificationFailed(
                "File size mismatch: expected {$expectedSize}, got {$actualSize}",
                '',
                $filePath
            );
        }
    }

    private function getBucket(): string
    {
        return $this->config['bucket'] ?? '';
    }
}
