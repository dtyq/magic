<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Infrastructure\Core\Traits\HasLogger;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use Throwable;

readonly class CloudswayVideoClient
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

    public function post(string $baseUrl, string $apiKey, string $path, array $payload): array
    {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $this->logger->info('cloudsway video post request', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'payload' => $payload,
        ]);

        $data = $this->requestJson(
            fn (): array => Json::decode((string) $this->createClient()->post(
                $normalizedBaseUrl . $normalizedPath,
                [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $apiKey,
                        'Content-Type' => 'application/json',
                    ],
                    'json' => $payload,
                ],
            )->getBody()),
            'post',
        );

        $this->logger->info('cloudsway video post response', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'response' => $this->sanitizeForLog($data),
        ]);

        return $data;
    }

    public function get(string $baseUrl, string $apiKey, string $path): array
    {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $this->logger->info('cloudsway video get request', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
        ]);

        $data = $this->requestJson(
            fn (): array => Json::decode((string) $this->createClient()->get(
                $normalizedBaseUrl . $normalizedPath,
                [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $apiKey,
                        'Content-Type' => 'application/json',
                    ],
                ],
            )->getBody()),
            'get',
        );

        $this->logger->info('cloudsway video get response', $this->sanitizeForLog($data));

        return $data;
    }

    private function createClient(): Client
    {
        return $this->clientFactory->create([
            'timeout' => 30,
            'verify' => false,
        ]);
    }

    private function requestJson(callable $request, string $action): array
    {
        try {
            $data = $request();
        } catch (RequestException $exception) {
            throw new ProviderVideoException($this->formatRequestExceptionMessage($exception, $action), $exception);
        } catch (Throwable $throwable) {
            throw new ProviderVideoException(sprintf('cloudsway video %s failed: %s', $action, $throwable->getMessage()), $throwable);
        }

        if (! is_array($data)) {
            throw new ProviderVideoException(sprintf('cloudsway video %s returned invalid json', $action));
        }

        return $data;
    }

    private function formatRequestExceptionMessage(RequestException $exception, string $action): string
    {
        if (! $exception->hasResponse()) {
            return sprintf('cloudsway video %s failed: %s', $action, $exception->getMessage());
        }

        $response = $exception->getResponse();
        $statusCode = $response?->getStatusCode() ?? 0;
        $reason = $response?->getReasonPhrase() ?? 'unknown';
        $body = trim((string) $response?->getBody());

        if ($body === '') {
            return sprintf('cloudsway video %s failed: HTTP %d %s', $action, $statusCode, $reason);
        }

        $providerMessage = $this->extractProviderMessageFromBody($body);
        return $providerMessage ?? sprintf(
            'cloudsway video %s failed: HTTP %d %s: %s',
            $action,
            $statusCode,
            $reason,
            $this->sanitizeResponseBody($body),
        );
    }

    private function sanitizeForLog(mixed $value, ?string $fieldName = null): mixed
    {
        if (is_array($value)) {
            $sanitized = [];
            foreach ($value as $key => $item) {
                $sanitized[$key] = $this->sanitizeForLog($item, is_string($key) ? $key : null);
            }
            return $sanitized;
        }

        if (! is_string($value)) {
            return $value;
        }

        $trimmedValue = trim($value);
        if ($trimmedValue === '') {
            return $value;
        }

        if (in_array($fieldName, ['bytesBase64Encoded', 'bytes_base64_encoded', 'b64_json'], true)) {
            return $this->summarizeString($trimmedValue, 'base64');
        }

        if (preg_match('#^data:(?<mime>[-\w.+/]+);base64,(?<data>.+)$#is', $trimmedValue, $matches) === 1) {
            return sprintf(
                '[data-uri base64 omitted mime=%s len=%d preview=%s...%s]',
                $matches['mime'],
                strlen($matches['data']),
                substr($matches['data'], 0, 24),
                substr($matches['data'], -24),
            );
        }

        if ($this->looksLikeLargeBase64($trimmedValue)) {
            return $this->summarizeString($trimmedValue, 'base64');
        }

        if (strlen($trimmedValue) > 1024) {
            return $this->summarizeString($trimmedValue, 'string');
        }

        return $value;
    }

    private function sanitizeResponseBody(string $body): string
    {
        try {
            $decoded = Json::decode($body);
            if (is_array($decoded)) {
                return Json::encode($this->sanitizeForLog($decoded), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        } catch (Throwable) {
        }

        return $this->sanitizeForLog($body);
    }

    private function extractProviderMessageFromBody(string $body): ?string
    {
        try {
            $decoded = Json::decode($body);
        } catch (Throwable) {
            return null;
        }

        if (! is_array($decoded)) {
            return null;
        }

        foreach ([
            $decoded['error']['message'] ?? null,
            $decoded['message'] ?? null,
            $decoded['msg'] ?? null,
            is_array($decoded['data'] ?? null) ? ($decoded['data']['message'] ?? null) : null,
            is_array($decoded['data']['error'] ?? null) ? ($decoded['data']['error']['message'] ?? null) : null,
            is_array($decoded['data'] ?? null) ? ($decoded['data']['task_status_msg'] ?? null) : null,
        ] as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return null;
    }

    private function looksLikeLargeBase64(string $value): bool
    {
        if (strlen($value) < 512) {
            return false;
        }

        return preg_match('/^[A-Za-z0-9+\/=\r\n]+$/', $value) === 1;
    }

    private function summarizeString(string $value, string $type): string
    {
        $length = strlen($value);
        $prefix = substr($value, 0, 24);
        $suffix = substr($value, -24);

        return sprintf('[%s omitted len=%d preview=%s...%s]', $type, $length, $prefix, $suffix);
    }
}
