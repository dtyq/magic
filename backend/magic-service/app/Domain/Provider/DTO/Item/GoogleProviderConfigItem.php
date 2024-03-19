<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

/**
 * Google 服务商配置项
 * 包含所有通用字段 + Google 特定字段.
 *
 * 配置示例 (Service Account):
 * {
 *   "auth_type": "service_account",
 *   "api_key": "your-google-api-key",
 *   "type": "service_account",
 *   "project_id": "your-project-id",
 *   "private_key_id": "your-private-key-id",
 *   "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
 *   "client_email": "your-client-email@your-project-id.iam.gserviceaccount.com",
 *   "client_id": "your-client-id",
 *   "auth_uri": "https://accounts.google.com/o/oauth2/auth",
 *   "token_uri": "https://oauth2.googleapis.com/token",
 *   "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
 *   "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-client-email%40your-project-id.iam.gserviceaccount.com",
 *   "universe_domain": "googleapis.com"
 * }
 *
 * 配置示例 (API Key):
 * {
 *   "auth_type": "api_key",
 *   "api_key": "your-google-api-key"
 * }
 */
class GoogleProviderConfigItem extends AbstractProviderConfigItem
{
    public const AUTH_TYPE_API_KEY = 'api_key';

    public const AUTH_TYPE_SERVICE_ACCOUNT = 'service_account';

    /**
     * 认证方式：api_key 或 service_account.
     */
    protected string $authType = self::AUTH_TYPE_API_KEY;

    /*
     * --------------------------------------------------------------------------
     * Service Account 认证相关字段
     * --------------------------------------------------------------------------
     */

    /**
     * 固定值：service_account.
     */
    protected string $type = 'service_account';

    /**
     * 项目ID.
     */
    protected string $projectId = '';

    /**
     * 私钥ID.
     */
    protected string $privateKeyId = '';

    /**
     * 私钥.
     */
    protected string $privateKey = '';

    /**
     * 客户端邮箱.
     */
    protected string $clientEmail = '';

    /**
     * 客户端ID.
     */
    protected string $clientId = '';

    /**
     * 认证URI.
     */
    protected string $authUri = 'https://accounts.google.com/o/oauth2/auth';

    /**
     * 令牌URI.
     */
    protected string $tokenUri = 'https://oauth2.googleapis.com/token';

    /**
     * 认证提供者X509证书URL.
     */
    protected string $authProviderX509CertUrl = 'https://www.googleapis.com/oauth2/v1/certs';

    /**
     * 客户端X509证书URL.
     */
    protected string $clientX509CertUrl = '';

    /**
     * 宇宙域名.
     */
    protected string $universeDomain = 'googleapis.com';

    /**
     * 区域 (Vertex AI 必填, e.g. us-central1).
     */
    protected string $location = '';

    /**
     * Google Cloud Storage Bucket 名称 (Vertex AI 模式下上传文件必填).
     */
    protected string $gcsBucket = '';

    public function __construct(?array $data = null)
    {
        if (empty($data)) {
            return;
        }

        parent::__construct($data);
    }

    public function getAuthType(): string
    {
        return $this->authType;
    }

    public function setAuthType(null|int|string $authType): void
    {
        if ($authType === null || $authType === '') {
            $this->authType = self::AUTH_TYPE_SERVICE_ACCOUNT;
        } else {
            $this->authType = (string) $authType;
        }
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function setProjectId(null|int|string $projectId): void
    {
        if ($projectId === null) {
            $this->projectId = '';
        } else {
            $this->projectId = (string) $projectId;
        }
    }

    public function getPrivateKeyId(): string
    {
        return $this->privateKeyId;
    }

    public function setPrivateKeyId(null|int|string $privateKeyId): void
    {
        if ($privateKeyId === null) {
            $this->privateKeyId = '';
        } else {
            $this->privateKeyId = (string) $privateKeyId;
        }
    }

    public function getPrivateKey(): string
    {
        return $this->privateKey;
    }

    public function setPrivateKey(null|int|string $privateKey): void
    {
        if ($privateKey === null) {
            $this->privateKey = '';
        } else {
            $this->privateKey = (string) $privateKey;
            //            $privateKey = trim($privateKey);
            //            $privateKeyStr = (string) $privateKey;
            // 处理转义的换行符：将 \n 转换为实际的换行符
            //            $this->privateKey = str_replace('\\n', "\n", $privateKeyStr);
        }
    }

    public function getClientId(): string
    {
        return $this->clientId;
    }

    public function setClientId(null|int|string $clientId): void
    {
        if ($clientId === null) {
            $this->clientId = '';
        } else {
            $this->clientId = (string) $clientId;
        }
    }

    public function getType(): string
    {
        return $this->type;
    }

    /**
     * type 字段是固定值，不允许修改.
     */
    public function setType(null|int|string $type): void
    {
        // type 固定为 service_account，不允许修改
        $this->type = 'service_account';
    }

    public function getClientEmail(): string
    {
        return $this->clientEmail;
    }

    /**
     * client_email 基于 project_id 自动生成，格式：vertex-express@{project_id}.iam.gserviceaccount.com.
     * 如果提供了 project_id，会自动覆盖手动设置的 client_email.
     */
    public function setClientEmail(null|int|string $clientEmail): void
    {
        // client_email 应该基于 project_id 自动生成，但如果 project_id 为空，允许手动设置
        if (! empty($clientEmail)) {
            $this->clientEmail = trim($clientEmail);
        } elseif (! empty($this->projectId)) {
            $this->clientEmail = 'vertex-express@' . $this->projectId . '.iam.gserviceaccount.com';
        }
    }

    public function getAuthUri(): string
    {
        return $this->authUri;
    }

    public function setAuthUri(null|int|string $authUri): void
    {
        if ($authUri === null || $authUri === '') {
            $this->authUri = 'https://accounts.google.com/o/oauth2/auth';
        } else {
            $this->authUri = (string) $authUri;
        }
    }

    public function getTokenUri(): string
    {
        return $this->tokenUri;
    }

    public function setTokenUri(null|int|string $tokenUri): void
    {
        if ($tokenUri === null || $tokenUri === '') {
            $this->tokenUri = 'https://oauth2.googleapis.com/token';
        } else {
            $this->tokenUri = (string) $tokenUri;
        }
    }

    public function getAuthProviderX509CertUrl(): string
    {
        return $this->authProviderX509CertUrl;
    }

    public function setAuthProviderX509CertUrl(null|int|string $authProviderX509CertUrl): void
    {
        if ($authProviderX509CertUrl === null || $authProviderX509CertUrl === '') {
            $this->authProviderX509CertUrl = 'https://www.googleapis.com/oauth2/v1/certs';
        } else {
            $this->authProviderX509CertUrl = (string) $authProviderX509CertUrl;
        }
    }

    public function getClientX509CertUrl(): string
    {
        return $this->clientX509CertUrl;
    }

    public function setClientX509CertUrl(null|int|string $clientX509CertUrl): void
    {
        if ($clientX509CertUrl === null) {
            $this->clientX509CertUrl = '';
        } else {
            $this->clientX509CertUrl = (string) $clientX509CertUrl;
        }

        // 如果设置了 client_x509_cert_url，自动更新 universe_domain
        if (! empty($this->clientX509CertUrl)) {
            $this->updateUniverseDomainFromCertUrl();
        }
    }

    public function getUniverseDomain(): string
    {
        return $this->universeDomain;
    }

    /**
     * universe_domain 基于 client_x509_cert_url 自动生成，不允许手动设置.
     */
    public function setUniverseDomain(null|int|string $universeDomain): void
    {
        // universe_domain 总是基于 client_x509_cert_url 自动生成，忽略手动设置的值
        $this->updateUniverseDomainFromCertUrl();
    }

    public function getLocation(): string
    {
        return $this->location;
    }

    public function setLocation(null|int|string $location): void
    {
        if ($location === null) {
            $this->location = '';
        } else {
            $this->location = (string) $location;
        }
    }

    public function getGcsBucket(): string
    {
        return $this->gcsBucket;
    }

    public function setGcsBucket(null|int|string $gcsBucket): void
    {
        if ($gcsBucket === null) {
            $this->gcsBucket = '';
        } else {
            $this->gcsBucket = (string) $gcsBucket;
        }
    }

    /**
     * 获取需要脱敏的字段列表（包含通用字段 + Google 特定字段）.
     *
     * @return array<string>
     */
    public function getSensitiveFields(): array
    {
        return array_merge(parent::getSensitiveFields(), ['privateKeyId', 'privateKey']);
    }

    /**
     * 判断配置是否为空（所有需要检查的字段都是空值）.
     * 包含通用字段检查 + Google 特定字段检查.
     */
    public function isEmpty(): bool
    {
        // 检查通用字段
        if (! parent::isEmpty()) {
            return false;
        }

        // 检查 Google 特定字段（排除有默认值的字段）
        return empty($this->getProjectId())
               && empty($this->getPrivateKeyId())
               && empty($this->getPrivateKey())
               && empty($this->getClientEmail())
               && empty($this->getClientId())
               && empty($this->getClientX509CertUrl())
               && empty($this->getLocation())
               && empty($this->getGcsBucket());
    }

    public function toOdinServiceAccountConfig(): ?array
    {
        if (empty($this->projectId)
            || empty($this->privateKeyId)
            || empty($this->privateKey)
            || empty($this->clientEmail)
            || empty($this->clientId)) {
            return null;
        }

        return [
            'type' => 'service_account',
            'project_id' => $this->projectId,
            'private_key_id' => $this->privateKeyId,
            'private_key' => $this->privateKey,
            'client_email' => $this->clientEmail,
            'client_id' => $this->clientId,
            'auth_uri' => $this->authUri,
            'token_uri' => $this->tokenUri,
            'auth_provider_x509_cert_url' => $this->authProviderX509CertUrl,
            'client_x509_cert_url' => $this->clientX509CertUrl,
            'universe_domain' => $this->universeDomain,
        ];
    }

    /**
     * 从 client_x509_cert_url 更新 universe_domain.
     */
    private function updateUniverseDomainFromCertUrl(): void
    {
        if (! empty($this->clientX509CertUrl)) {
            $parsedUrl = parse_url($this->clientX509CertUrl);
            if (isset($parsedUrl['host'])) {
                $host = $parsedUrl['host'];
                // 从 www.googleapis.com 提取 googleapis.com
                if (str_starts_with($host, 'www.')) {
                    $this->universeDomain = substr($host, 4);
                } else {
                    $this->universeDomain = $host;
                }
            }
        } else {
            $this->universeDomain = 'googleapis.com';
        }
    }
}
