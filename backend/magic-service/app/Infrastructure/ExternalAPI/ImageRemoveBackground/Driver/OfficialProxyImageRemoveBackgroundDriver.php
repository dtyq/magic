<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageRemoveBackground\Driver;

use App\Infrastructure\ExternalAPI\ImageRemoveBackground\DTO\ImageRemoveBackgroundDriverRequest;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\Exception\ImageRemoveBackgroundDriverException;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundDriverFactory;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundDriverInterface;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundResult;
use App\Infrastructure\Util\Http\GuzzleClientFactory;
use GuzzleHttp\Client;
use GuzzleHttp\RequestOptions;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 官方代理驱动。
 * 将安全 URL 转发至上游官方 API，再把返回的结果图下载到本地临时文件。
 */
class OfficialProxyImageRemoveBackgroundDriver implements ImageRemoveBackgroundDriverInterface
{
    private LoggerInterface $logger;

    /**
     * @param array<string, mixed> $providerConfig
     */
    public function __construct(
        private readonly array $providerConfig,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    public function getProviderCode(): string
    {
        return ImageRemoveBackgroundDriverFactory::PROVIDER_OFFICIAL_PROXY;
    }

    public function supportsDirectUrl(): bool
    {
        return true;
    }

    /**
     * 调用官方去背景接口，返回可匿名下载的结果 URL。
     */
    public function removeBackground(ImageRemoveBackgroundDriverRequest $request): ImageRemoveBackgroundResult
    {
        if ($request->getSourceType() !== ImageRemoveBackgroundDriverRequest::SOURCE_TYPE_URL) {
            throw new InvalidArgumentException('image_generate.invalid_image_url');
        }

        $requestUrl = trim((string) ($this->providerConfig['request_url'] ?: ($this->providerConfig['url'] ?? '')));
        $apiKey = trim((string) ($this->providerConfig['api_key'] ?? ''));
        if ($requestUrl === '' || $apiKey === '') {
            throw new InvalidArgumentException('image_generate.remove_background_provider_not_configured');
        }

        $client = $this->createClient($this->getTimeout());

        $payload = [
            'images' => [$request->getSourceValue()],
            'output_format' => 'png',
        ];
        $outputFormat = $request->getOutputFormat();
        if (is_string($outputFormat) && $outputFormat !== '') {
            $payload['output_format'] = $outputFormat;
        }

        $this->logger->info('ImageRemoveBackgroundOfficialProxyRequest', [
            'provider' => $this->getProviderCode(),
            'endpoint' => $requestUrl,
            'image_url_host' => $this->extractHost($request->getSourceValue()),
            'output_format' => $outputFormat,
            'timeout' => $this->getTimeout(),
        ]);

        try {
            $response = $client->post($requestUrl, [
                RequestOptions::HEADERS => [
                    'Authorization' => $apiKey,
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ],
                RequestOptions::JSON => $payload,
            ]);

            $responseData = json_decode((string) $response->getBody(), true);
            $this->logger->info('ImageRemoveBackgroundOfficialProxyResponse', [
                'provider' => $this->getProviderCode(),
                'status_code' => $response->getStatusCode(),
                'has_provider_error' => ! empty($responseData['provider_error_message']),
            ]);

            if (! is_array($responseData)) {
                $this->logger->error('ImageRemoveBackgroundOfficialProxyInvalidResponse', [
                    'provider' => $this->getProviderCode(),
                    'status_code' => $response->getStatusCode(),
                ]);
                throw new ImageRemoveBackgroundDriverException('Official proxy provider response format invalid', $response->getStatusCode(), $this->getProviderCode());
            }

            if (! empty($responseData['provider_error_message'])) {
                $this->logger->warning('ImageRemoveBackgroundOfficialProxyProviderError', [
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
                $this->logger->error('ImageRemoveBackgroundOfficialProxyMissingResultUrl', [
                    'provider' => $this->getProviderCode(),
                    'status_code' => $response->getStatusCode(),
                ]);
                throw new ImageRemoveBackgroundDriverException('Official proxy provider missing result url', $response->getStatusCode(), $this->getProviderCode());
            }

            $mimeType = (string) ($responseData['data'][0]['mime_type'] ?? '');
            if ($mimeType === '') {
                $mimeType = $this->resolveMimeType($outputFormat);
            }

            return ImageRemoveBackgroundResult::fromRemoteUrl(
                $resultUrl,
                $mimeType,
                $this->getProviderCode(),
            );
        } catch (Throwable $throwable) {
            $this->logger->error('ImageRemoveBackgroundOfficialProxyException', [
                'provider' => $this->getProviderCode(),
                'endpoint' => $requestUrl,
                'error' => $throwable->getMessage(),
            ]);
            throw $throwable;
        }
    }

    public function testConnection(ImageRemoveBackgroundDriverRequest $request): void
    {
        $this->removeBackground($request);
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

    private function resolveMimeType(string $outputFormat): string
    {
        return match (strtolower(trim($outputFormat))) {
            'jpeg', 'jpg' => 'image/jpeg',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'bmp' => 'image/bmp',
            default => 'image/png',
        };
    }
}
