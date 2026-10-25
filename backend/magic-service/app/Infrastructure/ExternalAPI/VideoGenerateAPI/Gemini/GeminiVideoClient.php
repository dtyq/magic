<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoErrorMapper;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\Util\File\TemporaryFileManager;
use App\Infrastructure\Util\Http\GuzzleClientFactory;
use App\Infrastructure\Util\Log\PayloadLogSanitizer;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\UriInterface;
use Throwable;

readonly class GeminiVideoClient
{
    use HasLogger;

    private const int MEDIA_MAX_BYTES = 104857600;

    public function __construct(
        ?LoggerFactory $loggerFactory = null,
    ) {
        if ($loggerFactory !== null) {
            $this->logger = $loggerFactory->get(self::class);
        }
    }

    public function post(string $baseUrl, string $apiKey, string $path, array $payload, array $logContext = [], string $proxyUrl = ''): array
    {
        return $this->postWithHeaders($baseUrl, ['x-goog-api-key' => $apiKey], $path, $payload, $logContext, $proxyUrl);
    }

    public function get(string $baseUrl, string $apiKey, string $path, array $logContext = [], string $proxyUrl = ''): array
    {
        return $this->getWithHeaders($baseUrl, ['x-goog-api-key' => $apiKey], $path, $logContext, $proxyUrl);
    }

    public function postWithHeaders(string $baseUrl, array $headers, string $path, array $payload, array $logContext = [], string $proxyUrl = ''): array
    {
        return $this->request('post', $baseUrl, $headers, $path, $payload, $logContext, $proxyUrl);
    }

    public function getWithHeaders(string $baseUrl, array $headers, string $path, array $logContext = [], string $proxyUrl = ''): array
    {
        return $this->request('get', $baseUrl, $headers, $path, null, $logContext, $proxyUrl);
    }

    public function downloadMediaToLocalFile(
        QueueExecutorConfig $config,
        string $uri,
    ): string {
        $url = $this->normalizeMediaUrl($config->getBaseUrl(), $uri);
        try {
            $this->assertAllowedMediaUri($url);
        } catch (ProviderVideoException) {
            return $url;
        }

        $proxyUrl = $config->getExtraString('proxy_url');
        $headers = ['x-goog-api-key' => $config->getApiKey()];

        $targetPath = TemporaryFileManager::createTempFile('gemini-video-');

        $localStream = null;
        try {
            $response = $this->requestMedia($config->getBaseUrl(), $headers, $uri, $proxyUrl);
            $localStream = fopen($targetPath, 'wb');
            if (! is_resource($localStream)) {
                throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage());
            }
            $body = $response->getBody();
            $downloadedBytes = 0;
            while (! $body->eof()) {
                $chunk = $body->read(8192);
                if ($chunk === '') {
                    continue;
                }
                $downloadedBytes += strlen($chunk);
                if ($downloadedBytes > self::MEDIA_MAX_BYTES) {
                    throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage());
                }
                if (fwrite($localStream, $chunk) === false) {
                    throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage());
                }
            }
        } catch (Throwable $throwable) {
            @unlink($targetPath);
            throw $throwable;
        } finally {
            if (is_resource($localStream)) {
                fclose($localStream);
            }
        }

        return $targetPath;
    }

    private function requestMedia(string $baseUrl, array $headers, string $uri, string $proxyUrl = ''): ResponseInterface
    {
        $url = $this->normalizeMediaUrl($baseUrl, $uri);
        $this->assertAllowedMediaUri($url);
        try {
            $response = $this->createClient($proxyUrl)->get($url, [
                'headers' => array_merge(['Accept' => '*/*'], $headers),
                'http_errors' => false,
                'allow_redirects' => [
                    'max' => 5,
                    'on_redirect' => function (RequestInterface $_request, ResponseInterface $_response, UriInterface $uri): void {
                        $this->assertAllowedMediaUri((string) $uri);
                    },
                ],
            ]);
            if ($response->getStatusCode() >= 400) {
                throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage());
            }

            return $response;
        } catch (RequestException $exception) {
            throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage(), $exception);
        } catch (ProviderVideoException $exception) {
            throw $exception;
        } catch (Throwable $throwable) {
            throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage(), $throwable);
        }
    }

    private function request(
        string $method,
        string $baseUrl,
        array $headers,
        string $path,
        ?array $payload,
        array $logContext,
        string $proxyUrl,
    ): array {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = $path === '' ? '' : '/' . ltrim($path, '/');
        $sanitizedLogContext = PayloadLogSanitizer::sanitizeValue($logContext);

        $this->logger->info('gemini video request', [
            'method' => $method,
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
            'payload' => $payload === null ? null : PayloadLogSanitizer::sanitizeValue($payload),
        ]);

        try {
            $response = $this->send($method, $normalizedBaseUrl . $normalizedPath, $headers, $payload, $proxyUrl);
            $body = (string) $response->getBody();
            if (trim($body) === '') {
                throw $this->responseFormatException();
            }

            try {
                $data = Json::decode($body);
            } catch (Throwable $throwable) {
                throw $this->responseFormatException($throwable);
            }

            if (! is_array($data)) {
                throw $this->responseFormatException();
            }

            $this->logger->info('gemini video response', [
                'http_status' => $response->getStatusCode(),
                'response' => PayloadLogSanitizer::sanitizeValue($data),
            ]);

            return $data;
        } catch (ProviderVideoException $exception) {
            $this->logger->error('gemini video error', [
                'http_status' => $exception->getHttpStatus(),
                'error_code' => $exception->getErrorCode(),
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        } catch (RequestException $exception) {
            $response = $exception->getResponse();
            $httpStatus = $exception->getResponse()?->getStatusCode();
            $responseBody = $response === null ? null : (string) $response->getBody();
            if ($response?->getBody()->isSeekable()) {
                $response->getBody()->rewind();
            }
            $errorCode = ProviderVideoErrorMapper::resolveGemini($exception);
            $this->logger->error('gemini video request failed', [
                'response' => $responseBody === null ? null : PayloadLogSanitizer::sanitizeResponseBody($responseBody),
                'error_code' => $errorCode->value,
                'http_status' => $httpStatus,
                'error_message' => $exception->getMessage(),
            ]);
            throw new ProviderVideoException(
                $errorCode,
                $errorCode->getMessage(),
                $exception,
            );
        } catch (Throwable $throwable) {
            throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage(), $throwable);
        }
    }

    private function send(string $method, string $url, array $headers, ?array $payload, string $proxyUrl): ResponseInterface
    {
        $options = [
            'headers' => array_merge($headers, ['Content-Type' => 'application/json']),
            'expect' => false,
        ];
        if ($payload !== null) {
            $options['json'] = $payload;
        }

        return $this->createClient($proxyUrl)->{$method}($url, $options);
    }

    private function createClient(string $proxyUrl = ''): Client
    {
        return GuzzleClientFactory::createProxyClient([], $proxyUrl);
    }

    private function normalizeMediaUrl(string $baseUrl, string $uri): string
    {
        $uri = trim($uri);
        if (preg_match('#^https?://#i', $uri) === 1) {
            return $uri;
        }
        return rtrim($baseUrl, '/') . '/' . ltrim($uri, '/');
    }

    private function assertAllowedMediaUri(string $uri): void
    {
        $parts = parse_url($uri);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        $port = $parts['port'] ?? 443;
        $allowed = in_array($host, [
            'generativelanguage.googleapis.com',
            'aiplatform.googleapis.com',
            'storage.googleapis.com',
            'googleusercontent.com',
            'gstatic.com',
        ], true)
            || str_ends_with($host, '-aiplatform.googleapis.com')
            || str_ends_with($host, '.storage.googleapis.com')
            || str_ends_with($host, '.googleusercontent.com')
            || str_ends_with($host, '.gstatic.com');
        if ($scheme !== 'https' || $host === '' || $port !== 443 || isset($parts['user']) || isset($parts['pass'])
            || ! $allowed) {
            throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage());
        }
    }

    private function responseFormatException(?Throwable $previous = null): ProviderVideoException
    {
        return new ProviderVideoException(VideoGenerateErrorCode::RESPONSE_FORMAT_ERROR, VideoGenerateErrorCode::RESPONSE_FORMAT_ERROR->getMessage(), $previous);
    }
}
