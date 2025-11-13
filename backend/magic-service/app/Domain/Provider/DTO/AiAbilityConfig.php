<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO;

/**
 * AI 能力配置值对象.
 */
class AiAbilityConfig
{
    // 服务商code
    private ?string $providerCode = null;

    // apikey
    private ?string $apiKey = null;

    // model_id，对应service_provider_models.model_id
    private ?string $modelId = null;

    // url
    private ?string $url = null;

    public function __construct(array $config = [])
    {
        $this->providerCode = $config['provider_code'] ?? null;
        $this->apiKey = $config['api_key'] ?? null;
        $this->url = $config['url'] ?? null;
        $this->modelId = isset($config['model_id']) ? (string) $config['model_id'] : null;
    }

    public function getProviderCode(): ?string
    {
        return $this->providerCode;
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
            'api_key' => $this->apiKey,
            'model_id' => $this->modelId,
            'url' => $this->url,
        ];
    }
}
