<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\StreamInterface;

class AzureOpenAIAPI
{
    private Client $client;

    private string $apiKey;

    private string $baseUrl;

    private string $apiVersion;

    public function __construct(string $apiKey, string $baseUrl, string $apiVersion)
    {
        $this->apiKey = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->apiVersion = $apiVersion;
        $this->client = new Client([
            'timeout' => 300,
            'verify' => false,
        ]);
    }

    /**
     * Image generation API call.
     */
    public function generateImage(array $data): array
    {
        $url = $this->buildUrl('images/generations');

        try {
            $response = $this->client->post($url, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'api-key' => $this->apiKey,
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
    public function editImage(array $imageUrls, ?string $maskUrl, string $prompt, string $size = '1024x1024', int $n = 1): array
    {
        $url = $this->buildUrl('images/edits');

        try {
            // Download images from OSS URLs to memory streams
            $multipartData = [];

            // Add multiple images
            foreach ($imageUrls as $index => $imageUrl) {
                $imageStreamBody = $this->downloadToStream($imageUrl);
                $multipartData[] = [
                    'name' => 'image',
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

            $response = $this->client->post($url, [
                'headers' => [
                    'api-key' => $this->apiKey,
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
            $response = $this->client->get($url, ['stream' => true]);
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
        // baseUrl already contains the full deployment path
        // e.g., https://kobayashi-aoai-westus3.openai.azure.com/openai/deployments/kobayashi-aoai-westus3-gpt-image-1-global
        return sprintf(
            '%s/%s?api-version=%s',
            $this->baseUrl,
            $endpoint,
            $this->apiVersion
        );
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
