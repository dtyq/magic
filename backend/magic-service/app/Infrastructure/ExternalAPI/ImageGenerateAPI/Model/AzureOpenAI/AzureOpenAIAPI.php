<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Support\ImageBase64DataUriParser;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Support\ImagePayloadLogSanitizerTrait;
use App\Infrastructure\Util\Http\GuzzleClientFactory;
use GuzzleHttp\Exception\RequestException;
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
     */
    public function editImage(string $model, array $imageUrls, ?string $maskUrl, string $prompt, string $size = '1024x1024', int $n = 1, ?string $quality = null): array
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

            if ($maskUrl !== null) {
                $multipartData[] = $this->createImageMultipartPart('mask', $maskUrl, 0, 'mask');
            }

            $multipartData[] = ['name' => 'prompt', 'contents' => $prompt];
            $multipartData[] = ['name' => 'size', 'contents' => $size];
            $multipartData[] = ['name' => 'n', 'contents' => (string) $n];
            if ($quality !== null) {
                $multipartData[] = ['name' => 'quality', 'contents' => $quality];
            }

            $this->logger->info('Azure OpenAI API 请求', [
                'url' => $url,
                'payload' => $this->sanitizePayloadForLog([
                    'imageUrls' => $imageUrls,
                    'maskUrl' => $maskUrl,
                    'prompt' => $prompt,
                    'size' => $size,
                    'n' => $n,
                    'quality' => $quality,
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

        if (isset($data['error'])) {
            ExceptionBuilder::throw(
                ImageGenerateErrorCode::GENERAL_ERROR,
                'Azure OpenAI API Error: ' . $data['error']['message']
            );
        }

        return $data;
    }

    /**
     * Handle request exceptions.
     */
    private function handleException(RequestException $e): void
    {
        $message = 'Azure OpenAI API request failed: ' . $e->getMessage();

        if ($e->hasResponse()) {
            $body = $e->getResponse()->getBody()->getContents();
            $data = json_decode($body, true);
            if (isset($data['error']['message'])) {
                $message = 'Azure OpenAI API Error: ' . $data['error']['message'];
            }
        }

        ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $message);
    }
}
