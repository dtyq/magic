<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

/**
 * AI 能力配置值对象.
 */
class AiAbilityConfig
{
    // 服务商code
    private ?string $providerCode = null;

    // 接入点
    private ?string $accessPoint = null;

    // apikey
    private ?string $apiKey = null;

    // model_id，对应service_provider_models.model_id
    private ?string $modelId = null;

    // 如果有接入点，则会转换成真实url
    private ?string $url = null;

    public function __construct(array $config = [])
    {
        $this->providerCode = $config['provider_code'] ?? null;
        $this->accessPoint = $config['access_point'] ?? null;
        $this->apiKey = $config['api_key'] ?? null;
        $this->url = $config['url'] ?? null;
        $this->modelId = isset($config['model_id']) ? (string) $config['model_id'] : null;
    }

    public function getProviderCode(): ?string
    {
        return $this->providerCode;
    }

    public function getAccessPoint(): ?string
    {
        return $this->accessPoint;
    }

    public function getApiKey(): ?string
    {
        return $this->apiKey;
    }

    public function getModelId(): ?string
    {
        return $this->modelId;
    }

    /**
     * 判断是否有提供商代码.
     */
    public function hasProviderCode(): bool
    {
        return $this->providerCode !== null && $this->providerCode !== '';
    }

    /**
     * 判断是否有接入点.
     */
    public function hasAccessPoint(): bool
    {
        return $this->accessPoint !== null && $this->accessPoint !== '';
    }

    /**
     * 判断是否有 API Key.
     */
    public function hasApiKey(): bool
    {
        return $this->apiKey !== null && $this->apiKey !== '';
    }

    /**
     * 判断是否有模型 ID.
     */
    public function hasModelId(): bool
    {
        return $this->modelId !== null;
    }

    public function getUrl(): ?string
    {
        return $this->url;
    }

    public function setUrl(?string $url): void
    {
        $this->url = $url;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'provider_code' => $this->providerCode,
            'access_point' => $this->accessPoint,
            'api_key' => $this->apiKey,
            'model_id' => $this->modelId,
            'url' => $this->url,
        ];
    }
}
