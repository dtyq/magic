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
 * 官方服务商驱动。
 * 该驱动将安全 URL 直接传给官方服务，再把官方返回的结果图下载到本地临时文件。
 */
class OfficialImageRemoveBackgroundDriver implements ImageRemoveBackgroundDriverInterface
{
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
        return ImageRemoveBackgroundDriverFactory::PROVIDER_OFFICIAL;
    }

    public function supportsDirectUrl(): bool
    {
        return true;
    }

    /**
     * 调用官方去背景接口，并把返回的结果 URL 落为本地文件供后续统一上传。
     */
    public function removeBackground(ImageRemoveBackgroundDriverRequest $request): ImageRemoveBackgroundDriverResponse
    {
        if ($request->getSourceType() !== ImageRemoveBackgroundDriverRequest::SOURCE_TYPE_URL) {
            throw new InvalidArgumentException('image_generate.invalid_image_url');
        }

        $requestUrl = trim((string) ($this->providerConfig['url'] ?? ''));
        $apiKey = trim((string) ($this->providerConfig['api_key'] ?? ''));
        if ($requestUrl === '' || $apiKey === '') {
            throw new InvalidArgumentException('image_generate.remove_background_provider_not_configured');
        }

        $client = $this->createClient($this->getTimeout());

        $payload = [
            'image_url' => $request->getSourceValue(),
        ];
        $outputFormat = $request->getOutputFormat();
        if (is_string($outputFormat) && $outputFormat !== '') {
            $payload['output_format'] = $outputFormat;
        }

        $this->logger->info('ImageRemoveBackgroundOfficialRequest', [
            'provider' => $this->getProviderCode(),
            'endpoint' => $requestUrl,
            'image_url_host' => $this->extractHost($request->getSourceValue()),
            'output_format' => $outputFormat,
            'timeout' => $this->getTimeout(),
        ]);

        try {
            $response = $client->post($requestUrl, [
                RequestOptions::HEADERS => [
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ],
                RequestOptions::JSON => $payload,
            ]);

            $responseData = json_decode((string) $response->getBody(), true);
            $this->logger->info('ImageRemoveBackgroundOfficialResponse', [
                'provider' => $this->getProviderCode(),
                'status_code' => $response->getStatusCode(),
                'has_provider_error' => ! empty($responseData['provider_error_message']),
            ]);

            if (! is_array($responseData)) {
                $this->logger->error('ImageRemoveBackgroundOfficialInvalidResponse', [
                    'provider' => $this->getProviderCode(),
                    'status_code' => $response->getStatusCode(),
                ]);
                throw new ImageRemoveBackgroundDriverException('Official provider response format invalid', $response->getStatusCode(), $this->getProviderCode());
            }

            if (! empty($responseData['provider_error_message'])) {
                $this->logger->warning('ImageRemoveBackgroundOfficialProviderError', [
                    'provider' => $this->getProviderCode(),
                    'status_code' => $response->getStatusCode(),
                    'provider_error_code' => $responseData['provider_error_code'] ?? null,
                    'provider_error_message' => $responseData['provider_error_message'],
                ]);
                throw new ImageRemoveBackgroundDriverException(
                    (string) $responseData['provider_error_message'],
                    isset($responseData['provider_error_code']) ? (int) $responseData['provider_error_code'] : $response->getStatusCode(),
                    $this->getProviderCode()
                );
            }

            $resultUrl = (string) ($responseData['data'][0]['url'] ?? '');
            if ($resultUrl === '') {
                $this->logger->error('ImageRemoveBackgroundOfficialMissingResultUrl', [
                    'provider' => $this->getProviderCode(),
                    'status_code' => $response->getStatusCode(),
                ]);
                throw new ImageRemoveBackgroundDriverException('Official provider missing result url', $response->getStatusCode(), $this->getProviderCode());
            }

            return $this->downloadResultImage($resultUrl, $this->getTimeout());
        } catch (Throwable $throwable) {
            $this->logger->error('ImageRemoveBackgroundOfficialException', [
                'provider' => $this->getProviderCode(),
                'endpoint' => $requestUrl,
                'error' => $throwable->getMessage(),
            ]);
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

    /**
     * 将官方服务返回的结果 URL 落为本地临时文件，以便后续统一上传到当前环境 OSS。
     */
    private function downloadResultImage(string $resultUrl, int $timeout): ImageRemoveBackgroundDriverResponse
    {
        try {
            $tempFile = TemporaryFileManager::createRemoveBackgroundTempFile('official_remove_bg_');
        } catch (RuntimeException) {
            throw new InvalidArgumentException('image_generate.create_temp_file_failed');
        }

        try {
            $this->logger->info('ImageRemoveBackgroundOfficialDownloadStart', [
                'provider' => $this->getProviderCode(),
                'result_url_host' => $this->extractHost($resultUrl),
                'timeout' => $timeout,
            ]);
            $client = $this->createClient($timeout);
            $response = $client->get($resultUrl, [
                RequestOptions::SINK => $tempFile,
            ]);

            if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
                $this->logger->warning('ImageRemoveBackgroundOfficialDownloadFailed', [
                    'provider' => $this->getProviderCode(),
                    'status_code' => $response->getStatusCode(),
                    'result_url_host' => $this->extractHost($resultUrl),
                ]);
                throw new ImageRemoveBackgroundDriverException('Failed to download official result image', $response->getStatusCode(), $this->getProviderCode());
            }

            $mimeType = $this->imageFileInspector->assertImageFile($tempFile);
            $this->logger->info('ImageRemoveBackgroundOfficialDownloadSuccess', [
                'provider' => $this->getProviderCode(),
                'status_code' => $response->getStatusCode(),
                'mime_type' => $mimeType,
                'file_size' => filesize($tempFile) ?: 0,
            ]);
            return new ImageRemoveBackgroundDriverResponse($tempFile, $mimeType);
        } catch (Throwable $throwable) {
            if (is_file($tempFile)) {
                @unlink($tempFile);
            }
            throw $throwable;
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

    private function extractHost(string $url): string
    {
        return (string) (parse_url($url, PHP_URL_HOST) ?: '');
    }
}
