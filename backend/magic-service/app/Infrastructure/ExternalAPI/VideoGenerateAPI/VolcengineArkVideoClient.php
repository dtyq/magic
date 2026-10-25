<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Util\Log\PayloadLogSanitizer;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use Throwable;

readonly class VolcengineArkVideoClient
{
    use HasLogger;

    // Seedance 任务创建在高峰期可能长时间挂起，请求超时放宽到 180 秒避免 30 秒过早中断。
    private const int REQUEST_TIMEOUT_SECONDS = 180;

    public function __construct(
        private ClientFactory $clientFactory,
        ?LoggerFactory $loggerFactory = null,
    ) {
        if ($loggerFactory !== null) {
            $this->logger = $loggerFactory->get(self::class);
        }
    }

    public function post(string $baseUrl, string $apiKey, string $path, array $payload, array $logContext = []): array
    {
        return $this->handleRequestException(
            fn () => $this->requestJson(
                'post',
                $baseUrl,
                $apiKey,
                $path,
                ['json' => $payload],
                $logContext,
            ),
            'post',
            $baseUrl,
            $path,
            $logContext,
        );
    }

    public function get(string $baseUrl, string $apiKey, string $path, array $logContext = []): array
    {
        return $this->handleRequestException(
            fn () => $this->requestJson(
                'get',
                $baseUrl,
                $apiKey,
                $path,
                [],
                $logContext,
            ),
            'get',
            $baseUrl,
            $path,
            $logContext,
        );
    }

    public function requestJson(
        string $method,
        string $baseUrl,
        string $apiKey,
        string $path,
        array $options,
        array $logContext,
    ): array {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $startedAt = microtime(true);
        $sanitizedLogContext = PayloadLogSanitizer::sanitizeValue($logContext);

        $this->logger->info('volcengine ark video request', [
            'method' => $method,
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
            'payload' => is_array($options['json'] ?? null) ? PayloadLogSanitizer::sanitizeValue($options['json']) : null,
        ]);

        $requestOptions = array_merge([
            'headers' => [
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ],
        ], $options);

        $response = match ($method) {
            'post' => $this->createClient()->post($normalizedBaseUrl . $normalizedPath, $requestOptions),
            'get' => $this->createClient()->get($normalizedBaseUrl . $normalizedPath, $requestOptions),
            default => throw new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, sprintf('unsupported volcengine ark video method %s', $method)),
        };
        $data = Json::decode((string) $response->getBody());

        $this->logger->info('volcengine ark video response', [
            'method' => $method,
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
            'http_status' => $response->getStatusCode(),
            'provider_request_id' => $response->getHeaderLine('x-tt-logid'),
            'elapsed_ms' => $this->calculateElapsedMilliseconds($startedAt),
            'response' => PayloadLogSanitizer::sanitizeValue($data),
        ]);

        return $data;
    }

    private function createClient(): Client
    {
        return $this->clientFactory->create([
            'timeout' => self::REQUEST_TIMEOUT_SECONDS,
        ]);
    }

    private function handleRequestException(
        callable $request,
        string $method,
        string $baseUrl,
        string $path,
        array $logContext,
    ): array {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $startedAt = microtime(true);
        $sanitizedLogContext = PayloadLogSanitizer::sanitizeValue($logContext);

        try {
            return $request();
        } catch (RequestException $exception) {
            $response = $exception->getResponse();
            $responseBody = $response === null ? null : (string) $response->getBody();
            if ($response?->getBody()->isSeekable()) {
                $response->getBody()->rewind();
            }
            $httpStatus = $response?->getStatusCode();
            $resolvedError = ProviderVideoErrorMapper::resolveVolcengine($exception, $responseBody);
            $errorCode = $resolvedError['errorCode'];
            $this->logger->error('volcengine ark video error', [
                'method' => $method,
                'base_url' => $normalizedBaseUrl,
                'path' => $normalizedPath,
                'context' => $sanitizedLogContext,
                'response' => $responseBody === null ? null : PayloadLogSanitizer::sanitizeResponseBody($responseBody),
                'error_code' => $errorCode->value,
                'http_status' => $httpStatus,
                'elapsed_ms' => $this->calculateElapsedMilliseconds($startedAt),
                'error_message' => $exception->getMessage(),
            ]);
            throw new ProviderVideoException(
                $errorCode,
                $resolvedError['message'],
                $exception,
            );
        } catch (ProviderVideoException $exception) {
            throw $exception;
        } catch (Throwable $throwable) {
            $this->logger->error('volcengine ark video error', [
                'context' => $sanitizedLogContext,
                'elapsed_ms' => $this->calculateElapsedMilliseconds($startedAt),
                'error' => sprintf('volcengine ark video %s failed: %s', $method, $throwable->getMessage()),
            ]);
            throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage(), $throwable);
        }
    }

    private function calculateElapsedMilliseconds(float $startedAt): int
    {
        return max(0, (int) round((microtime(true) - $startedAt) * 1000));
    }
}
