<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\Client;

use App\Infrastructure\ExternalAPI\Google\Auth\GoogleServiceAccountTokenProvider;
use App\Infrastructure\Util\Http\GuzzleClientFactory;
use Exception;
use Hyperf\Codec\Json;
use InvalidArgumentException;

use function Hyperf\Translation\__;

class VertexAIClient extends AbstractGoogleGeminiClient
{
    // ========== Google Cloud Storage 配置 ==========
    /** @var string Google Cloud Storage 文件上传基础 URL */
    protected const GCS_UPLOAD_BASE_URL = 'https://storage.googleapis.com/upload/storage/v1/b';

    // ========== Vertex AI Platform 配置 ==========
    /** @var string Vertex AI Platform 默认主机地址（全局区域） */
    protected const DEFAULT_AI_PLATFORM_HOST = 'https://aiplatform.googleapis.com';

    // ========== OAuth2 认证配置 ==========
    private GoogleServiceAccountTokenProvider $tokenProvider;

    public function __construct(array $config, string $modelId = 'gemini-2.5-flash-image', ?string $proxyUrl = null)
    {
        parent::__construct($config, $modelId, $proxyUrl);
        $this->tokenProvider = new GoogleServiceAccountTokenProvider($config, $proxyUrl);
    }

    public function uploadFile(string $filePath, string $mimeType): string
    {
        if (! empty($this->config['gcs_bucket'])) {
            return $this->uploadToGCS($filePath, $mimeType);
        }

        throw new Exception(__('image_generate.vertex_ai_does_not_support_file_upload'));
    }

    protected function validateConfig(): void
    {
        if (empty($this->config['project_id'])) {
            throw new InvalidArgumentException('Google Gemini Service Account mode requires project_id');
        }
        if (empty($this->config['client_email'])) {
            throw new InvalidArgumentException('Google Gemini Service Account mode requires client_email');
        }
        if (empty($this->config['private_key'])) {
            throw new InvalidArgumentException('Google Gemini Service Account mode requires private_key');
        }
    }

    protected function uploadToGCS(string $filePath, string $mimeType): string
    {
        if (empty($this->config['gcs_bucket'])) {
            throw new Exception(__('image_generate.gcs_bucket_not_configured'));
        }

        if (! file_exists($filePath)) {
            throw new Exception(__('image_generate.file_not_found', ['path' => $filePath]));
        }

        $bucket = $this->config['gcs_bucket'];
        $objectName = 'gemini_uploads/' . uniqid('', true) . '_' . basename($filePath);

        $url = self::GCS_UPLOAD_BASE_URL . "/{$bucket}/o?uploadType=media&name=" . urlencode($objectName);

        $headers = array_merge($this->getAuthHeaders(), [
            'Content-Type' => $mimeType,
            'Content-Length' => (string) filesize($filePath),
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
                throw new Exception(__('image_generate.gcs_upload_failed', ['error' => $errorMessage]));
            }

            $this->logger->info('Google GCS 文件上传成功', [
                'bucket' => $bucket,
                'object' => $objectName,
                'mimeType' => $mimeType,
            ]);

            return "gs://{$bucket}/{$objectName}";
        } catch (Exception $e) {
            $this->logger->error('Google GCS 文件上传异常', ['error' => $e->getMessage()]);
            throw $e;
        } finally {
            if (is_resource($fileHandle)) {
                fclose($fileHandle);
            }
        }
    }

    protected function buildUrl(string $endpoint): string
    {
        $location = $this->config['location'] ?? '';
        $projectId = $this->config['project_id'];
        $host = $this->resolveAiPlatformHost();

        if (empty($location)) {
            $path = sprintf('/v1/projects/%s/locations/global/publishers/google/models/%s:%s', $projectId, $this->modelId, $endpoint);
        } else {
            $path = sprintf('/v1/projects/%s/locations/%s/publishers/google/models/%s:%s', $projectId, $location, $this->modelId, $endpoint);
        }

        return $host . $path;
    }

    protected function getAuthHeaders(): array
    {
        return ['Authorization' => 'Bearer ' . $this->tokenProvider->getAccessToken()];
    }

    protected function refreshAuth(): bool
    {
        $this->tokenProvider->invalidate();
        return true;
    }

    private function resolveAiPlatformHost(): string
    {
        $configuredUrl = trim((string) ($this->config['url'] ?? ''));
        if ($configuredUrl === '' || ! str_contains($configuredUrl, 'aiplatform.googleapis.com')) {
            return self::DEFAULT_AI_PLATFORM_HOST;
        }

        $parsed = parse_url(rtrim($configuredUrl, '/'));
        if (! isset($parsed['scheme'], $parsed['host'])) {
            return self::DEFAULT_AI_PLATFORM_HOST;
        }

        $normalizedHost = strtolower($parsed['host']);
        if (preg_match('/^[a-z0-9-]+-aiplatform\.googleapis\.com$/', $normalizedHost) === 1) {
            return self::DEFAULT_AI_PLATFORM_HOST;
        }

        return $parsed['scheme'] . '://' . $parsed['host'];
    }
}
