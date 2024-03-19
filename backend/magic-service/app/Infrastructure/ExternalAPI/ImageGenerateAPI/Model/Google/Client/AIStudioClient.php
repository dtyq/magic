<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\Client;

use App\Infrastructure\Util\Http\GuzzleClientFactory;
use Exception;
use Hyperf\Codec\Json;
use InvalidArgumentException;

use function Hyperf\Translation\__;

class AIStudioClient extends AbstractGoogleGeminiClient
{
    /** @var string Google Generative Language API 默认基础 URL */
    protected const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

    /** @var string 文件上传路径前缀 */
    protected const UPLOAD_PATH_PREFIX = '/upload/';

    public function uploadFile(string $filePath, string $mimeType): string
    {
        if (! file_exists($filePath)) {
            throw new Exception(__('image_generate.file_not_found', ['path' => $filePath]));
        }

        $fileSize = filesize($filePath);
        $apiUrl = rtrim($this->config['url'] ?? self::DEFAULT_BASE_URL, '/');

        if (str_contains($apiUrl, self::UPLOAD_PATH_PREFIX)) {
            $uploadBaseUrl = $apiUrl;
        } else {
            $uploadBaseUrl = preg_replace('#/(v\d+\w*)#', self::UPLOAD_PATH_PREFIX . '$1', $apiUrl, 1);
            if ($uploadBaseUrl === null || $uploadBaseUrl === $apiUrl) {
                $domainName = 'generativelanguage.googleapis.com';
                if (str_contains($apiUrl, $domainName)) {
                    $uploadBaseUrl = str_replace($domainName, $domainName . self::UPLOAD_PATH_PREFIX, $apiUrl);
                } elseif (str_contains($apiUrl, '/googleapis/')) {
                    $uploadBaseUrl = str_replace('/googleapis/', '/googleapis' . self::UPLOAD_PATH_PREFIX, $apiUrl);
                }
            }
        }

        $url = "{$uploadBaseUrl}/files?uploadType=media";

        $headers = array_merge($this->getAuthHeaders(), [
            'X-Goog-Upload-Protocol' => 'raw',
            'X-Goog-Upload-Header-Content-Length' => $fileSize,
            'X-Goog-Upload-Header-Content-Type' => $mimeType,
            'Content-Type' => $mimeType,
        ]);

        $client = GuzzleClientFactory::createProxyClient(['timeout' => self::REQUEST_TIMEOUT], $this->proxyUrl);
        $fileHandle = null;

        try {
            $fileHandle = fopen($filePath, 'r');
            $response = $client->post($url, [
                'headers' => $headers,
                'body' => $fileHandle,
            ]);

            $result = Json::decode($response->getBody()->getContents());

            if ($response->getStatusCode() !== 200) {
                $errorMessage = $result['error']['message'] ?? __('image_generate.http_error', ['status' => $response->getStatusCode()]);
                throw new Exception(__('image_generate.file_upload_failed', ['error' => $errorMessage]));
            }

            if (empty($result['file']['uri'])) {
                throw new Exception(__('image_generate.file_upload_response_missing_uri'));
            }

            $this->logger->info('Google Gemini (AI Studio) 文件上传成功', [
                'uri' => $result['file']['uri'],
                'mimeType' => $mimeType,
                'size' => $fileSize,
            ]);

            return $result['file']['uri'];
        } catch (Exception $e) {
            $this->logger->error('Google Gemini (AI Studio) 文件上传异常', ['error' => $e->getMessage()]);
            throw $e;
        } finally {
            if (is_resource($fileHandle)) {
                fclose($fileHandle);
            }
        }
    }

    protected function validateConfig(): void
    {
        if (empty($this->config['api_key'])) {
            throw new InvalidArgumentException('Google Gemini API Key mode requires api_key');
        }
    }

    protected function buildUrl(string $endpoint): string
    {
        $baseUrl = rtrim($this->config['url'] ?? self::DEFAULT_BASE_URL, '/');

        if (! preg_match('/v1(beta)?\d*$/', $baseUrl)) {
            if ($baseUrl === 'https://generativelanguage.googleapis.com') {
                $baseUrl .= '/v1beta';
            }
        }

        return "{$baseUrl}/models/{$this->modelId}:{$endpoint}";
    }

    protected function getAuthHeaders(): array
    {
        return ['x-goog-api-key' => $this->config['api_key'] ?? ''];
    }
}
