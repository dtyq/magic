<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageRemoveBackground\Driver;

use App\Infrastructure\ExternalAPI\ImageRemoveBackground\DTO\ImageRemoveBackgroundDriverRequest;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\DTO\ImageRemoveBackgroundDriverResponse;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\Exception\ImageRemoveBackgroundDriverException;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundDriverFactory;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundDriverInterface;
use App\Infrastructure\Util\File\ImageFileInspector;
use App\Infrastructure\Util\File\TemporaryFileManager;
use App\Infrastructure\Util\Http\GuzzleClientFactory;
use GuzzleHttp\Client;
use GuzzleHttp\RequestOptions;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

/**
 * 内置服务商驱动。
 * 该驱动接收本地文件，并通过 multipart 表单上传到自建模型服务。
 */
class BuiltinModelServiceImageRemoveBackgroundDriver implements ImageRemoveBackgroundDriverInterface
{
    private const ACCEPT_MIME_MAP = [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'bmp' => 'image/bmp',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'tiff' => 'image/tiff',
        'jp2' => 'image/jp2',
        'jxl' => 'image/jxl',
        'heif' => 'image/heif',
        'image/jpeg' => 'image/jpeg',
        'image/png' => 'image/png',
        'image/bmp' => 'image/bmp',
        'image/gif' => 'image/gif',
        'image/webp' => 'image/webp',
        'image/tiff' => 'image/tiff',
        'image/jp2' => 'image/jp2',
        'image/jxl' => 'image/jxl',
        'image/heif' => 'image/heif',
    ];

    private LoggerInterface $logger;

    /**
     * @param array<string, mixed> $providerConfig
     */
    public function __construct(
        private readonly array $providerConfig,
        private readonly ImageFileInspector $imageFileInspector,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    public function getProviderCode(): string
    {
        return ImageRemoveBackgroundDriverFactory::PROVIDER_BUILTIN_MODEL_SERVICE;
    }

    public function supportsDirectUrl(): bool
    {
        return false;
    }

    /**
     * 自建模型服务返回的是图片二进制流，因此直接使用 sink 落盘，避免大图进入内存。
     */
    public function removeBackground(ImageRemoveBackgroundDriverRequest $request): ImageRemoveBackgroundDriverResponse
    {
        if ($request->getSourceType() !== ImageRemoveBackgroundDriverRequest::SOURCE_TYPE_FILE) {
            throw new InvalidArgumentException('image_generate.invalid_image_url');
        }

        $requestUrl = trim((string) ($this->providerConfig['url'] ?? ''));
        $apiKey = trim((string) ($this->providerConfig['api_key'] ?? ''));
        $modelName = trim((string) ($this->providerConfig['model_name'] ?? ''));
        if ($requestUrl === '' || $apiKey === '' || $modelName === '') {
            throw new InvalidArgumentException('image_generate.remove_background_provider_not_configured');
        }

        $filePath = $request->getSourceValue();
        if (! is_file($filePath)) {
            throw new InvalidArgumentException('image_generate.file_not_found');
        }

        try {
            $tempFile = TemporaryFileManager::createRemoveBackgroundTempFile('builtin_remove_bg_');
        } catch (RuntimeException) {
            throw new InvalidArgumentException('image_generate.create_temp_file_failed');
        }

        try {
            $client = $this->createClient($this->getTimeout());

            $acceptFormat = $request->getOutputFormat();
            if (! is_string($acceptFormat) || $acceptFormat === '') {
                $acceptFormat = 'png';
            }
            $acceptHeader = $this->buildAcceptHeader($acceptFormat);
            $sourceMimeType = $request->getSourceMimeType() ?: 'application/octet-stream';
            $uploadFileName = $this->buildUploadFileName($filePath, $sourceMimeType);
            $fileResource = fopen($filePath, 'rb');
            if ($fileResource === false) {
                throw new InvalidArgumentException('image_generate.read_temp_file_failed');
            }

            $this->logger->info('ImageRemoveBackgroundBuiltinRequest', [
                'provider' => $this->getProviderCode(),
                'endpoint' => $requestUrl,
                'model_name' => $modelName,
                'accept_header' => $acceptHeader,
                'timeout' => $this->getTimeout(),
                'source_file_name' => basename($filePath),
                'source_file_size' => filesize($filePath) ?: 0,
                'source_mime_type' => $sourceMimeType,
                'upload_file_name' => $uploadFileName,
            ]);

            try {
                $response = $client->post($requestUrl, [
                    RequestOptions::HEADERS => [
                        'Authorization' => $apiKey,
                        'accept' => $acceptHeader,
                    ],
                    RequestOptions::MULTIPART => [
                        [
                            'name' => 'modelName',
                            'contents' => $modelName,
                        ],
                        [
                            'name' => 'imageData',
                            'contents' => $fileResource,
                            'filename' => $uploadFileName,
                            'headers' => [
                                'Content-Type' => $sourceMimeType,
                            ],
                        ],
                    ],
                    RequestOptions::SINK => $tempFile,
                ]);
            } finally {
                if (is_resource($fileResource)) {
                    fclose($fileResource);
                }
            }

            if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
                $providerError = $response->getHeaderLine('x-error') ?: 'Builtin model service request failed';
                $this->logger->warning('ImageRemoveBackgroundBuiltinProviderError', [
                    'provider' => $this->getProviderCode(),
                    'status_code' => $response->getStatusCode(),
                    'provider_error_message' => $providerError,
                ]);
                throw new ImageRemoveBackgroundDriverException($providerError, $response->getStatusCode(), $this->getProviderCode());
            }

            $mimeType = $this->imageFileInspector->assertImageFile($tempFile);
            $this->logger->info('ImageRemoveBackgroundBuiltinSuccess', [
                'provider' => $this->getProviderCode(),
                'status_code' => $response->getStatusCode(),
                'mime_type' => $mimeType,
                'file_size' => filesize($tempFile) ?: 0,
            ]);
            return new ImageRemoveBackgroundDriverResponse($tempFile, $mimeType);
        } catch (Throwable $throwable) {
            $this->logger->error('ImageRemoveBackgroundBuiltinException', [
                'provider' => $this->getProviderCode(),
                'endpoint' => $requestUrl,
                'error' => $throwable->getMessage(),
            ]);
            if (is_file($tempFile)) {
                @unlink($tempFile);
            }
            throw $throwable;
        }
    }

    public function testConnection(ImageRemoveBackgroundDriverRequest $request): void
    {
        $response = $this->removeBackground($request);
        $resultFilePath = $response->getResultFilePath();
        if (is_file($resultFilePath)) {
            @unlink($resultFilePath);
        }
    }

    private function getTimeout(): int
    {
        return (int) ($this->providerConfig['timeout'] ?? 300);
    }

    /**
     * 统一创建 driver 内部使用的 HTTP 客户端，确保超时与错误处理策略一致。
     */
    private function createClient(int $timeout): Client
    {
        return GuzzleClientFactory::createProxyClient([
            RequestOptions::TIMEOUT => $timeout,
            'http_errors' => false,
        ]);
    }

    /**
     * 为 multipart 上传补齐稳定文件名，避免临时文件缺少后缀影响第三方识别图片类型。
     */
    private function buildUploadFileName(string $filePath, string $mimeType): string
    {
        $extension = strtolower((string) pathinfo($filePath, PATHINFO_EXTENSION));
        if ($extension === '') {
            $extension = match ($mimeType) {
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp',
                'image/gif' => 'gif',
                'image/bmp' => 'bmp',
                default => 'png',
            };
        }

        return sprintf('remove_background_input.%s', $extension);
    }

    /**
     * 与第三方 curl 约定保持一致，accept 头使用受支持的 MIME 形式。
     */
    private function buildAcceptHeader(string $acceptFormat): string
    {
        $normalizedFormat = strtolower(trim($acceptFormat));
        return self::ACCEPT_MIME_MAP[$normalizedFormat] ?? 'image/png';
    }
}
