<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Support\ImagePayloadLogSanitizerTrait;
use App\Infrastructure\Util\File\ImageBase64DataUriParser;
use App\Infrastructure\Util\Http\GuzzleClientFactory;
use Exception;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\StreamInterface;
use Psr\Log\LoggerInterface;

class AzureOpenAIAPI
{
    use ImagePayloadLogSanitizerTrait;

    private const REQUEST_TIMEOUT = 1200;

    protected LoggerInterface $logger;

    private string $apiKey;

    private string $baseUrl;

    private string $apiVersion;

    private ?string $proxyUrl;

    public function __construct(
        AzureOpenAIClientConfig $azureOpenAIClientConfig
    ) {
        $this->apiKey = $azureOpenAIClientConfig->getApiKey();
        $this->baseUrl = rtrim($azureOpenAIClientConfig->getBaseUrl(), '/');
        $this->proxyUrl = $azureOpenAIClientConfig->getProxyUrl();
        $this->apiVersion = $azureOpenAIClientConfig->getApiVersion();
        $this->logger = di(LoggerFactory::class)->get(static::class);
    }

    /**
     * Image generation API call.
     */
    public function generateImage(string $model, array $data): array
    {
        $url = $this->buildUrl($model, 'images/generations');

        $this->logger->info('Azure OpenAI API 请求', [
            'url' => $url,
            'payload' => $this->sanitizePayloadForLog($data),
        ]);

        try {
            $client = GuzzleClientFactory::createProxyClient(
                ['timeout' => self::REQUEST_TIMEOUT, 'verify' => false],
                $this->proxyUrl
            );

            $response = $client->post($url, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer ' . $this->apiKey,
                ],
                'json' => $data,
            ]);

            return $this->handleResponse($response);
        } catch (RequestException $e) {
            $this->handleException($e);
            throw $e;
        }
    }

    /**
     * Image edit API call with OSS URL support - supports multiple images.
     *
     * @param array<int, string> $imageUrls 参考图（URL 或 base64 data URI）
     * @param array<string, mixed> $fields 官方 images/edits 字段，键即线上字段名：prompt / size / n /
     *                                     quality / background / output_format / mask / extra
     *                                     （extra 为网关自定义透传，非官方字段）；值为 null 或 '' 的项不发送
     */
    public function editImage(string $model, array $imageUrls, array $fields): array
    {
        $url = $this->buildUrl($model, 'images/edits');

        try {
            $client = GuzzleClientFactory::createProxyClient(
                ['timeout' => self::REQUEST_TIMEOUT, 'verify' => false],
                $this->proxyUrl
            );

            $multipartData = [];

            $imageKey = count($imageUrls) > 1 ? 'image[]' : 'image';
            foreach ($imageUrls as $index => $imageUrl) {
                $multipartData[] = $this->createImageMultipartPart($imageKey, $imageUrl, $index);
            }

            if (! empty($fields['mask'])) {
                $multipartData[] = $this->createImageMultipartPart('mask', (string) $fields['mask'], 0, 'mask');
            }

            $multipartData[] = ['name' => 'model', 'contents' => $model];

            foreach ($fields as $name => $value) {
                if ($name === 'mask' || $value === null || $value === '') {
                    continue;
                }
                $multipartData[] = [
                    'name' => $name,
                    'contents' => $name === 'extra' ? Json::encode($value) : (string) $value,
                ];
            }

            $this->logger->info('Azure OpenAI API 请求', [
                'url' => $url,
                'payload' => $this->sanitizePayloadForLog([
                    'imageUrls' => $imageUrls,
                    'fields' => $fields,
                ]),
            ]);

            $response = $client->post($url, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->apiKey,
                ],
                'multipart' => $multipartData,
            ]);

            return $this->handleResponse($response);
        } catch (RequestException $e) {
            $this->handleException($e);
            throw $e;
        }
    }

    /**
     * Download file from URL to memory stream.
     */
    private function downloadToStream(string $url): StreamInterface
    {
        try {
            $client = GuzzleClientFactory::createProxyClient(
                ['timeout' => self::REQUEST_TIMEOUT, 'verify' => false],
                $this->proxyUrl
            );

            $response = $client->get($url, ['stream' => true]);
            return $response->getBody();
        } catch (RequestException $e) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'Failed to download image from URL: ' . $url);
        }
    }

    /**
     * Build one multipart image part for Azure OpenAI image edit.
     */
    private function createImageMultipartPart(string $name, string $image, int $index, string $filenamePrefix = 'image'): array
    {
        try {
            $base64Image = ImageBase64DataUriParser::parseDecoded($image);
        } catch (InvalidArgumentException) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'Invalid base64 image data');
        }

        if ($base64Image !== null) {
            return [
                'name' => $name,
                'contents' => $base64Image['binary_data'],
                'filename' => $filenamePrefix . $index . '.' . $base64Image['extension'],
                'headers' => [
                    'Content-Type' => $base64Image['mime_type'],
                ],
            ];
        }

        $imageStreamBody = $this->downloadToStream($image);
        return [
            'name' => $name,
            'contents' => $imageStreamBody->getContents(),
            'filename' => "{$filenamePrefix}{$index}.png",
        ];
    }

    /**
     * Build full API URL.
     *
     * 若 baseUrl 仅为 host（无有效 path），自动补全部署路径：
     * {host}/openai/deployments/{model}/{endpoint}
     * 否则直接拼接：{baseUrl}/{endpoint}
     */
    private function buildUrl(string $model, string $endpoint): string
    {
        $path = parse_url($this->baseUrl, PHP_URL_PATH) ?? '';

        if (empty($path) || $path === '/') {
            $base = rtrim($this->baseUrl, '/') . '/openai/deployments/' . $model;
        } else {
            $base = $this->baseUrl;
        }

        $url = sprintf('%s/%s', $base, ltrim($endpoint, '/'));

        if (trim($this->apiVersion)) {
            $url = sprintf('%s?api-version=%s', $url, $this->apiVersion);
        }

        return $url;
    }

    /**
     * Handle API response.
     */
    private function handleResponse(ResponseInterface $response): array
    {
        $body = $response->getBody()->getContents();
        $data = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'Invalid JSON response');
        }

        $this->logger->info('Azure OpenAI API 请求结果', [
            'response' => $this->sanitizePayloadForLog($data),
        ]);

        if (isset($data['error'])) {
            $this->throwProviderError($data);
        }

        return $data;
    }

    /**
     * Handle request exceptions.
     */
    private function handleException(RequestException $e): void
    {
        $result = [
            'error' => [
                'message' => $e->getMessage(),
            ],
        ];

        if ($e->hasResponse()) {
            $response = $e->getResponse();
            $bodyStream = $response->getBody();
            $body = (string) $bodyStream;
            if ($bodyStream->isSeekable()) {
                $bodyStream->rewind();
            }
            $data = json_decode($body, true);
            if (is_array($data)) {
                $result = $data;
            } elseif ($body !== '') {
                $result = ['error' => ['message' => $body]];
            }

            $this->logger->info('Azure OpenAI API 请求结果', [
                'response' => $this->sanitizePayloadForLog($result),
            ]);
        }

        $this->throwProviderError($result, $e);
    }

    private function throwProviderError(array $result, ?RequestException $requestException = null): never
    {
        $providerError = is_array($result['error'] ?? null) ? $result['error'] : [];
        $providerErrorCode = (string) ($providerError['code'] ?? '');
        $providerErrorMessage = (string) ($providerError['message'] ?? '');
        $errorCode = $this->resolveProviderErrorCode($providerErrorCode, $providerErrorMessage);

        $throwable = $requestException ?? new Exception(
            json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR)
                ?: 'Invalid Azure OpenAI response.'
        );

        ExceptionBuilder::throw($errorCode, throwable: $throwable);
    }

    private function resolveProviderErrorCode(string $providerErrorCode, string $providerErrorMessage): ImageGenerateErrorCode
    {
        $normalizedMessage = strtolower($providerErrorMessage);
        $errorRules = [
            ImageGenerateErrorCode::OUTPUT_IMAGE_AUDIT_FAILED->value => [
                'provider_codes' => ['contentFilter', 'content_filter', 'content_policy_violation'],
                'keywords' => ['safety', '安全'],
            ],
            ImageGenerateErrorCode::INVALID_ASPECT_RATIO->value => [
                'provider_codes' => [],
                'keywords' => ['aspect ratio', '宽高比', '尺寸比例'],
            ],
            ImageGenerateErrorCode::UNSUPPORTED_IMAGE_SIZE->value => [
                'provider_codes' => [],
                'keywords' => ['invalid size', 'unsupported size', '尺寸'],
            ],
        ];

        foreach ($errorRules as $errorCode => $rule) {
            if (in_array($providerErrorCode, $rule['provider_codes'], true)) {
                return ImageGenerateErrorCode::from($errorCode);
            }

            foreach ($rule['keywords'] as $keyword) {
                if (str_contains($normalizedMessage, strtolower($keyword))) {
                    return ImageGenerateErrorCode::from($errorCode);
                }
            }
        }

        return ImageGenerateErrorCode::GENERAL_ERROR;
    }
}
