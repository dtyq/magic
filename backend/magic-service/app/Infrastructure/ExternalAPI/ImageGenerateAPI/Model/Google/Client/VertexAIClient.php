<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\Client;

use App\Infrastructure\Util\Http\GuzzleClientFactory;
use Exception;
use Google\Auth\Credentials\ServiceAccountCredentials;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\Redis\Redis;
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

    /** @var string Vertex AI Platform 区域化主机地址模板，%s 为区域名称 */
    protected const REGIONAL_HOST_TEMPLATE = 'https://%s-aiplatform.googleapis.com';

    // ========== OAuth2 认证配置 ==========
    /** @var string OAuth2 认证范围 */
    protected const OAUTH_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

    /** @var string OAuth2 认证 URI */
    protected const OAUTH_AUTH_URI = 'https://accounts.google.com/o/oauth2/auth';

    /** @var string OAuth2 Token URI */
    protected const OAUTH_TOKEN_URI = 'https://oauth2.googleapis.com/token';

    /** @var string OAuth2 证书 URL */
    protected const OAUTH_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';

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
            'Content-Length' => filesize($filePath),
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

        if (empty($location)) {
            $host = self::DEFAULT_AI_PLATFORM_HOST;
            $path = sprintf('/v1/projects/%s/locations/global/publishers/google/models/%s:%s', $projectId, $this->modelId, $endpoint);
        } else {
            $host = sprintf(self::REGIONAL_HOST_TEMPLATE, trim($location));
            $path = sprintf('/v1/projects/%s/locations/%s/publishers/google/models/%s:%s', $projectId, $location, $this->modelId, $endpoint);
        }

        if (! empty($this->config['url']) && str_contains($this->config['url'], 'aiplatform.googleapis.com')) {
            $host = rtrim($this->config['url'], '/');
            $parsed = parse_url($host);
            if (isset($parsed['scheme'], $parsed['host'])) {
                $host = $parsed['scheme'] . '://' . $parsed['host'];
            }
        }

        return $host . $path;
    }

    protected function getAuthHeaders(): array
    {
        return ['Authorization' => 'Bearer ' . $this->getServiceAccountToken()];
    }

    protected function getServiceAccountToken(): string
    {
        $cacheKey = $this->getCacheKey();

        $cachedToken = $this->redis->get($cacheKey);
        if ($cachedToken) {
            return $cachedToken;
        }

        $tokenData = $this->fetchServiceAccountTokenFromApi();

        if (isset($tokenData['access_token'])) {
            $expiresIn = $tokenData['expires_in'] ?? 3500;
            // 提前 60 秒过期，避免临界点问题
            $this->redis->set($cacheKey, $tokenData['access_token'], max(1, $expiresIn - 60));
        }

        return $tokenData['access_token'];
    }

    protected function getCacheKey(): string
    {
        // 缓存 Key 生成策略：
        // 1. project_id + client_email: 区分不同的服务账号
        // 2. private_key + private_key_id: 确保密钥轮换时缓存自动失效，使用新密钥生成 Token
        // 3. OAUTH_SCOPE: 确保权限范围变更时缓存隔离
        $keySource = ($this->config['project_id'] ?? '')
                     . ($this->config['client_email'] ?? '')
                     . ($this->config['private_key'] ?? '')
                     . ($this->config['private_key_id'] ?? '')
                     . ($this->config['client_id'] ?? '')
                     . self::OAUTH_SCOPE;

        return 'google_sa_token_' . md5($keySource);
    }

    protected function refreshAuth(): bool
    {
        $cacheKey = $this->getCacheKey();
        $container = ApplicationContext::getContainer();
        $redis = $container->has(Redis::class) ? $container->get(Redis::class) : null;

        if ($redis) {
            $redis->del($cacheKey);
            return true;
        }

        return false;
    }

    protected function fetchServiceAccountTokenFromApi(): array
    {
        try {
            $scopes = [self::OAUTH_SCOPE];

            $jsonKey = [
                'type' => 'service_account',
                'project_id' => $this->config['project_id'] ?? '',
                'private_key_id' => $this->config['private_key_id'] ?? '',
                'private_key' => $this->config['private_key'] ?? '',
                'client_email' => $this->config['client_email'] ?? '',
                'client_id' => $this->config['client_id'] ?? '',
                'auth_uri' => $this->config['auth_uri'] ?? self::OAUTH_AUTH_URI,
                'token_uri' => $this->config['token_uri'] ?? self::OAUTH_TOKEN_URI,
                'auth_provider_x509_cert_url' => $this->config['auth_provider_x509_cert_url'] ?? self::OAUTH_CERTS_URL,
                'client_x509_cert_url' => $this->config['client_x509_cert_url'] ?? '',
            ];

            $credentials = new ServiceAccountCredentials($scopes, $jsonKey);

            $httpHandler = null;
            if (! empty($this->proxyUrl)) {
                $client = GuzzleClientFactory::createProxyClient(['timeout' => self::REQUEST_TIMEOUT], $this->proxyUrl);
                $httpHandler = function ($request, $options = []) use ($client) {
                    return $client->send($request, $options);
                };
            }

            $token = $credentials->fetchAuthToken($httpHandler);
            if (isset($token['access_token'])) {
                return $token;
            }

            throw new Exception('Failed to fetch access token');
        } catch (Exception $e) {
            $this->logger->error('Google Service Account 鉴权失败', ['error' => $e->getMessage()]);
            throw $e;
        }
    }
}
