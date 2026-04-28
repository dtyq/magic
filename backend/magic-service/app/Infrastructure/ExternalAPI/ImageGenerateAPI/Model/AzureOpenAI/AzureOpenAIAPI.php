<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Http\GuzzleClientFactory;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Logger\LoggerFactory;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\StreamInterface;
use Psr\Log\LoggerInterface;

class AzureOpenAIAPI
{
    private const REQUEST_TIMEOUT = 600;

    protected LoggerInterface $logger;

    private string $apiKey;

    private string $baseUrl;

    private string $apiVersion;

    private ?string $proxyUrl;

    private AzureAuthType $authType;

    public function __construct(
        AzureOpenAIClientConfig $azureOpenAIClientConfig
    ) {
        $this->apiKey = $azureOpenAIClientConfig->getApiKey();
        $this->baseUrl = rtrim($azureOpenAIClientConfig->getBaseUrl(), '/');
        $this->proxyUrl = $azureOpenAIClientConfig->getProxyUrl();
        $this->apiVersion = $azureOpenAIClientConfig->getApiVersion();
        $this->authType = $azureOpenAIClientConfig->getAuthType();
        $this->logger = di(LoggerFactory::class)->get(static::class);
    }

    /**
     * Image generation API call.
     */
    public function generateImage(array $data): array
    {
        $url = $this->buildUrl('images/generations');

        $this->logger->info('Azure OpenAI API 请求', [
            'url' => $url,
            'auth_type' => $this->authType->value,
            'payload' => $data,
        ]);

        try {
            $client = GuzzleClientFactory::createProxyClient(
                ['timeout' => self::REQUEST_TIMEOUT, 'verify' => false],
                $this->proxyUrl
            );

            $response = $client->post($url, [
                'headers' => array_merge(
                    ['Content-Type' => 'application/json'],
                    $this->buildAuthHeaders()
                ),
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
    public function editImage(string $model, array $imageUrls, ?string $maskUrl, string $prompt, string $size = '1024x1024', int $n = 1): array
    {
        $url = $this->buildUrl('images/edits');

        try {
            $client = GuzzleClientFactory::createProxyClient(
                ['timeout' => self::REQUEST_TIMEOUT, 'verify' => false],
                $this->proxyUrl
            );

            // Download images from OSS URLs to memory streams
            $multipartData = [];

            $imageKey = count($imageUrls) > 1 ? 'image[]' : 'image';
            // Add multiple images
            foreach ($imageUrls as $index => $imageUrl) {
                $imageStreamBody = $this->downloadToStream($imageUrl);
                $multipartData[] = [
                    'name' => $imageKey,
                    'contents' => $imageStreamBody->getContents(),
                    'filename' => "image{$index}.png",
                ];
            }

            // Add mask if provided
            if ($maskUrl !== null) {
                $maskStreamBody = $this->downloadToStream($maskUrl);
                $multipartData[] = [
                    'name' => 'mask',
                    'contents' => $maskStreamBody->getContents(),
                    'filename' => 'mask.png',
                ];
            }

            // Add other parameters
            $multipartData[] = ['name' => 'prompt', 'contents' => $prompt];
            $multipartData[] = ['name' => 'size', 'contents' => $size];
            $multipartData[] = ['name' => 'n', 'contents' => (string) $n];

            $this->logger->info('Azure OpenAI API 请求', [
                'url' => $url,
                'auth_type' => $this->authType->value,
                'payload' => [
                    'imageUrls' => $imageUrls,
                    'maskUrl' => $maskUrl,
                    'prompt' => $prompt,
                    'size' => $size,
                    'n' => $n,
                    'model' => $model,
                ],
            ]);

            $response = $client->post($url, [
                'headers' => $this->buildAuthHeaders(),
                'multipart' => $multipartData,
            ]);

            return $this->handleResponse($response);
        } catch (RequestException $e) {
            $this->handleException($e);
            throw $e;
        }
    }

    /**
     * 根据鉴权模式构建请求头.
     */
    private function buildAuthHeaders(): array
    {
        return match ($this->authType) {
            AzureAuthType::ApiKey => ['api-key' => $this->apiKey],
            AzureAuthType::Token => ['Authorization' => 'Bearer ' . $this->apiKey],
        };
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
     * Build full API URL.
     */
    private function buildUrl(string $endpoint): string
    {
        $url = sprintf(
            '%s/%s',
            $this->baseUrl,
            ltrim($endpoint, '/')
        );

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
