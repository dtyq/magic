<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Driver\S3;

use Aws\S3\S3Client;
use Aws\Sts\StsClient;
use Dtyq\CloudFile\Kernel\AdapterName;
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
use League\Flysystem\FileAttributes;
use Throwable;

class S3Expand implements ExpandInterface
{
    private array $config;

    private S3Client $client;

    private S3Client $publicClient;

    public function __construct(array $config = [])
    {
        $this->config = $config;
        $this->client = $this->createS3Client($config, true);
        $this->publicClient = $this->createS3Client($config, false);
    }

    public function getUploadCredential(CredentialPolicy $credentialPolicy, array $options = []): array
    {
        return $credentialPolicy->isSts()
            ? $this->getUploadCredentialBySts($credentialPolicy, $options)
            : $this->getUploadCredentialBySimple($credentialPolicy, $options);
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

    private function getUploadCredentialBySimple(CredentialPolicy $credentialPolicy, array $options = []): array
    {
        $issuedAt = time();
        $expiresAt = $issuedAt + $credentialPolicy->getExpires();
        $amzDate = gmdate('Ymd\THis\Z', $issuedAt);
        $shortDate = gmdate('Ymd', $issuedAt);
        $region = $this->config['region'] ?? 'us-east-1';
        $bucket = $this->getBucket();
        $dir = $credentialPolicy->getDir();
        $accessKey = $this->config['accessKey'] ?? '';
        $credentialEndpoint = $this->getCredentialEndpoint($options);
        $credentialScope = "{$shortDate}/{$region}/s3/aws4_request";
        $policy = [
            'expiration' => gmdate('Y-m-d\TH:i:s\Z', $expiresAt),
            'conditions' => [
                ['bucket' => $bucket],
                ['starts-with', '$key', $dir],
                ['x-amz-algorithm' => 'AWS4-HMAC-SHA256'],
                ['x-amz-credential' => "{$accessKey}/{$credentialScope}"],
                ['x-amz-date' => $amzDate],
            ],
        ];

        $contentType = $credentialPolicy->getContentType();
        if ($contentType !== '') {
            $policy['conditions'][] = ['Content-Type' => $contentType];
        }

        $encodedPolicy = base64_encode((string) json_encode($policy, JSON_UNESCAPED_SLASHES));
        $signature = $this->signPolicy($shortDate, $region, $encodedPolicy);
        $fields = [
            'policy' => $encodedPolicy,
            'X-Amz-Algorithm' => 'AWS4-HMAC-SHA256',
            'X-Amz-Credential' => "{$accessKey}/{$credentialScope}",
            'X-Amz-Date' => $amzDate,
            'X-Amz-Signature' => $signature,
        ];

        if ($contentType !== '') {
            $fields['Content-Type'] = $contentType;
        }

        return [
            'platform' => AdapterName::MINIO,
            'region' => $region,
            'endpoint' => $credentialEndpoint,
            'bucket' => $bucket,
            'dir' => $dir,
            'version' => $this->config['version'] ?? 'latest',
            'use_path_style_endpoint' => $this->config['use_path_style_endpoint'] ?? true,
            'host' => $this->buildUploadHost($bucket, $credentialEndpoint),
            'url' => $this->buildUploadHost($bucket, $credentialEndpoint),
            'policy' => $encodedPolicy,
            'signature' => $signature,
            'access_key_id' => $accessKey,
            'content_type' => $contentType,
            'x_amz_algorithm' => $fields['X-Amz-Algorithm'],
            'x_amz_credential' => $fields['X-Amz-Credential'],
            'x_amz_date' => $fields['X-Amz-Date'],
            'fields' => $fields,
            'expires' => $expiresAt,
        ];
    }

    /**
     * Get upload credential using STS (Security Token Service).
     *
     * @see https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
     */
    private function getUploadCredentialBySts(CredentialPolicy $credentialPolicy, array $options = []): array
    {
        $roleSessionName = $credentialPolicy->getRoleSessionName() ?: uniqid('cloudfile_');
        $roleArn = $this->config['role_arn'] ?? '';
        if (empty($roleArn)) {
            throw new CloudFileException('未配置role_arn');
        }

        // Expires between 900~43200 seconds for AssumeRole
        $expires = max(900, min(43200, $credentialPolicy->getExpires()));
        $credentialEndpoint = $this->getCredentialEndpoint($options);

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
        $bucketArn = "arn:aws:s3:::{$this->getBucket()}";

        // Build object resource ARN(s) covering the target directory.
        //
        // When $dir is non-empty it always ends with '/' (enforced by CredentialPolicy::formatDirPath).
        // MinIO STS evaluates '*' as "one or more characters" in some configurations, which means
        // the pattern "dir/*" does NOT match the directory marker "dir/" itself (empty suffix).
        // To ensure both the folder marker and all objects inside are covered, we emit two ARNs:
        //   1. The exact directory marker:  "arn:...bucket/dir/"
        //   2. All objects inside:          "arn:...bucket/dir/*"
        if (! empty($dir)) {
            $dirArn = "{$bucketArn}/{$dir}"; // e.g. "arn:aws:s3:::xxxxx/xxx/xxx/xx/workspace/"
            $objectResource = [
                $dirArn,        // directory marker: ".../workspace/"
                $dirArn . '*',  // all objects inside: ".../workspace/*"
            ];
        } else {
            $objectResource = "{$bucketArn}/*";
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
                        'Resource' => $bucketArn,
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
                        'Resource' => $objectResource,
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
                        'Resource' => $objectResource,
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
        $expiration = $credentials['Expiration'];
        $expirationTimestamp = is_object($expiration) && method_exists($expiration, 'getTimestamp')
            ? $expiration->getTimestamp()
            : strtotime((string) $expiration);

        return [
            'platform' => AdapterName::MINIO,
            'region' => $this->config['region'] ?? 'us-east-1',
            'endpoint' => $credentialEndpoint,
            'version' => $this->config['version'] ?? 'latest',
            'use_path_style_endpoint' => $this->config['use_path_style_endpoint'] ?? true,
            'credentials' => [
                'access_key_id' => $credentials['AccessKeyId'],
                'secret_access_key' => $credentials['SecretAccessKey'],
                'session_token' => $credentials['SessionToken'],
                'expiration' => $expiration,
            ],
            'access_key_id' => $credentials['AccessKeyId'],
            'access_key_secret' => $credentials['SecretAccessKey'],
            'sts_token' => $credentials['SessionToken'],
            'bucket' => $this->getBucket(),
            'dir' => $credentialPolicy->getDir(),
            'expires' => $expirationTimestamp,
        ];
    }

    private function getPreSignedUrl(string $path, int $expires = 3600, array $params = []): string
    {
        $defaultParams = [
            'Bucket' => $this->getBucket(),
            'Key' => $path,
        ];

        $command = $this->publicClient->getCommand('GetObject', array_merge($defaultParams, $params));
        $request = $this->publicClient->createPresignedRequest($command, "+{$expires} seconds");

        return (string) $request->getUri();
    }

    private function getMeta(string $path): FileMetadata
    {
        try {
            $result = $this->client->headObject([
                'Bucket' => $this->getBucket(),
                'Key' => $path,
            ]);

            $fileName = basename($path);
            $lastModified = isset($result['LastModified']) ? strtotime($result['LastModified']) : null;

            return new FileMetadata(
                $fileName,
                $path,
                new FileAttributes(
                    $path,
                    $result['ContentLength'] ?? null,
                    null,
                    $lastModified,
                    $result['ContentType'] ?? null
                )
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
        // Note: Current implementation is synchronous, so concurrency control is not applicable
        // Each downloadChunk() call blocks until completion
        // Future enhancement: Implement true async downloads using Guzzle promises or similar

        $totalChunks = count($chunks);
        $completedChunks = 0;

        foreach ($chunks as $chunk) {
            // Download chunk synchronously
            $this->downloadChunk($chunk, $filePath);
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

    private function signPolicy(string $shortDate, string $region, string $policy): string
    {
        $secretKey = $this->config['secretKey'] ?? '';
        $dateKey = hash_hmac('sha256', $shortDate, 'AWS4' . $secretKey, true);
        $regionKey = hash_hmac('sha256', $region, $dateKey, true);
        $serviceKey = hash_hmac('sha256', 's3', $regionKey, true);
        $signingKey = hash_hmac('sha256', 'aws4_request', $serviceKey, true);

        return hash_hmac('sha256', $policy, $signingKey);
    }

    private function buildUploadHost(string $bucket, ?string $endpoint = null): string
    {
        $endpoint = rtrim((string) ($endpoint ?? ''), '/');
        if ($endpoint === '') {
            return '';
        }

        if ($this->config['use_path_style_endpoint'] ?? true) {
            return "{$endpoint}/{$bucket}";
        }

        $parts = parse_url($endpoint);
        if (! is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return $endpoint;
        }

        $authority = $bucket . '.' . $parts['host'];
        if (! empty($parts['port'])) {
            $authority .= ':' . $parts['port'];
        }

        return $parts['scheme'] . '://' . $authority;
    }

    private function createS3Client(array $config, bool $preferInternalEndpoint = true): S3Client
    {
        $clientConfig = [
            'version' => $config['version'] ?? 'latest',
            'region' => $config['region'] ?? 'us-east-1',
            'use_path_style_endpoint' => $config['use_path_style_endpoint'] ?? true,
            'credentials' => [
                'key' => $config['accessKey'] ?? '',
                'secret' => $config['secretKey'] ?? '',
            ],
        ];

        $endpoint = $preferInternalEndpoint
            ? ($config['internal_endpoint'] ?? $config['endpoint'] ?? null)
            : ($config['endpoint'] ?? null);
        if (! empty($endpoint)) {
            $clientConfig['endpoint'] = $endpoint;
        }

        if (! empty($config['sessionToken'])) {
            $clientConfig['credentials']['token'] = $config['sessionToken'];
        }

        return new S3Client($clientConfig);
    }

    private function getPublicEndpoint(): ?string
    {
        return $this->config['endpoint'] ?? null;
    }

    private function getInternalEndpoint(): ?string
    {
        return $this->config['internal_endpoint'] ?? null;
    }

    private function getCredentialEndpoint(array $options = []): ?string
    {
        if ((bool) ($options['internal_endpoint'] ?? false)) {
            return $this->getInternalEndpoint() ?? $this->getPublicEndpoint();
        }

        return $this->getPublicEndpoint();
    }
}
