<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Util\SSRF\SSRFUtil;
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

    public function post(string $baseUrl, string $apiKey, string $path, array $payload, array $logContext = []): array
    {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $sanitizedLogContext = $this->sanitizeForLog($logContext);
        $this->logger->info('cloudsway video post request', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
            'payload' => $this->sanitizeForLog($payload),
        ]);

        try {
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
        } catch (ProviderVideoException $exception) {
            $this->logger->error('cloudsway video post error', [
                'base_url' => $normalizedBaseUrl,
                'path' => $normalizedPath,
                'context' => $sanitizedLogContext,
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        $this->logger->info('cloudsway video post response', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
            'response' => $this->sanitizeForLog($data),
        ]);

        return $data;
    }

    public function get(string $baseUrl, string $apiKey, string $path, array $logContext = []): array
    {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $sanitizedLogContext = $this->sanitizeForLog($logContext);
        $this->logger->info('cloudsway video get request', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
        ]);

        try {
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
        } catch (ProviderVideoException $exception) {
            $this->logger->error('cloudsway video get error', [
                'base_url' => $normalizedBaseUrl,
                'path' => $normalizedPath,
                'context' => $sanitizedLogContext,
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        $this->logger->info('cloudsway video get response', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
            'response' => $this->sanitizeForLog($data),
        ]);

        return $data;
    }

    /**
     * @return array{bytes_base64_encoded: string, mime_type: string}
     */
    public function downloadMediaAsBase64(string $url): array
    {
        $safeUrl = SSRFUtil::getSafeUrl($url, replaceIp: false);
        $this->logger->info('cloudsway video media download request', [
            'url' => $safeUrl,
        ]);

        try {
            $response = $this->createClient()->get($safeUrl, [
                'headers' => [
                    'Accept' => '*/*',
                ],
            ]);
        } catch (RequestException $exception) {
            throw new ProviderVideoException($this->formatRequestExceptionMessage($exception, 'download media'), $exception);
        } catch (Throwable $throwable) {
            throw new ProviderVideoException(sprintf('cloudsway video download media failed: %s', $throwable->getMessage()), $throwable);
        }

        $content = (string) $response->getBody();
        if ($content === '') {
            throw new ProviderVideoException('cloudsway video download media failed: empty response body');
        }

        $mimeType = $this->resolveMediaMimeType($response->getHeaderLine('Content-Type'), $safeUrl);
        $result = [
            'bytes_base64_encoded' => base64_encode($content),
            'mime_type' => $mimeType,
        ];

        $this->logger->info('cloudsway video media download response', [
            'url' => $safeUrl,
            'content_length' => strlen($content),
            'mime_type' => $mimeType,
        ]);

        return $result;
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

    private function resolveMediaMimeType(?string $contentType, string $url): string
    {
        $normalizedContentType = trim((string) $contentType);
        if ($normalizedContentType !== '') {
            $normalizedContentType = strtolower(trim(explode(';', $normalizedContentType)[0] ?? ''));
            if ($normalizedContentType !== '') {
                return $normalizedContentType;
            }
        }

        $path = strtolower(parse_url($url, PHP_URL_PATH) ?? '');
        return match (true) {
            str_ends_with($path, '.jpg'), str_ends_with($path, '.jpeg') => 'image/jpeg',
            str_ends_with($path, '.webp') => 'image/webp',
            str_ends_with($path, '.gif') => 'image/gif',
            str_ends_with($path, '.bmp') => 'image/bmp',
            str_ends_with($path, '.avif') => 'image/avif',
            default => 'image/png',
        };
    }
}
