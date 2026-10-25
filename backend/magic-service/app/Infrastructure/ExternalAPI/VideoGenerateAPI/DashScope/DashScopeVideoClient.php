<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope;

use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoErrorMapper;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\Util\Log\PayloadLogSanitizer;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use Throwable;

readonly class DashScopeVideoClient
{
    use HasLogger;

    public function __construct(
        private ClientFactory $clientFactory,
        ?LoggerFactory $loggerFactory = null,
    ) {
        if ($loggerFactory !== null) {
            $this->logger = $loggerFactory->get(self::class);
        }
    }

    public function post(string $baseUrl, string $apiKey, string $path, array $payload, array $logContext = [], string $proxyUrl = ''): array
    {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $sanitizedLogContext = PayloadLogSanitizer::sanitizeValue($logContext);
        $this->logger->info('dashscope video post request', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
            'payload' => PayloadLogSanitizer::sanitizeValue($payload),
        ]);

        try {
            $data = $this->requestJson(
                fn (): array => Json::decode((string) $this->createClient($proxyUrl)->post(
                    $normalizedBaseUrl . $normalizedPath,
                    [
                        'headers' => [
                            'Authorization' => 'Bearer ' . $apiKey,
                            'Content-Type' => 'application/json',
                            'X-DashScope-Async' => 'enable',
                        ],
                        'json' => $payload,
                    ],
                )->getBody()),
            );
        } catch (ProviderVideoException $exception) {
            $this->logger->error('dashscope video post error', [
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        $this->logger->info('dashscope video post response', [
            'response' => PayloadLogSanitizer::sanitizeValue($data),
        ]);

        return $data;
    }

    public function get(string $baseUrl, string $apiKey, string $path, array $logContext = [], string $proxyUrl = ''): array
    {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $sanitizedLogContext = PayloadLogSanitizer::sanitizeValue($logContext);
        $this->logger->info('dashscope video get request', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
        ]);

        try {
            $data = $this->requestJson(
                fn (): array => Json::decode((string) $this->createClient($proxyUrl)->get(
                    $normalizedBaseUrl . $normalizedPath,
                    [
                        'headers' => [
                            'Authorization' => 'Bearer ' . $apiKey,
                            'Content-Type' => 'application/json',
                        ],
                    ],
                )->getBody()),
            );
        } catch (ProviderVideoException $exception) {
            $this->logger->error('dashscope video get error', [
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        $this->logger->info('dashscope video get response', [
            'response' => PayloadLogSanitizer::sanitizeValue($data),
        ]);

        return $data;
    }

    private function createClient(string $proxyUrl = ''): Client
    {
        $options = [
            'timeout' => 30,
            'verify' => false,
        ];
        if ($proxyUrl !== '') {
            $options['proxy'] = $proxyUrl;
        }
        return $this->clientFactory->create($options);
    }

    private function requestJson(callable $request): array
    {
        try {
            $data = $request();
        } catch (RequestException $exception) {
            $errorCode = ProviderVideoErrorMapper::resolveDashScope($exception);
            throw new ProviderVideoException(
                $errorCode,
                $errorCode->getMessage(),
                $exception,
            );
        } catch (Throwable $throwable) {
            throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage(), $throwable);
        }

        return $data;
    }
}
