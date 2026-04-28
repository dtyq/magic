<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI;

final class AzureOpenAIClientConfig
{
    public function __construct(
        private string $apiKey,
        private string $baseUrl,
        private string $apiVersion = '',
        private ?string $proxyUrl = null,
    ) {
        $this->baseUrl = rtrim($this->baseUrl, '/');
    }

    public static function fromServiceProviderConfig(array $serviceProviderConfig): self
    {
        return new self(
            (string) ($serviceProviderConfig['api_key'] ?? ''),
            (string) ($serviceProviderConfig['url'] ?? $serviceProviderConfig['api_base'] ?? ''),
            (string) ($serviceProviderConfig['api_version'] ?? ''),
            isset($serviceProviderConfig['proxy_url']) ? (string) $serviceProviderConfig['proxy_url'] : null,
        );
    }

    public function withApiKey(string $apiKey): self
    {
        $clone = clone $this;
        $clone->apiKey = $apiKey;

        return $clone;
    }

    public function getApiKey(): string
    {
        return $this->apiKey;
    }

    public function getBaseUrl(): string
    {
        return $this->baseUrl;
    }

    public function getApiVersion(): string
    {
        return $this->apiVersion;
    }

    public function getProxyUrl(): ?string
    {
        return $this->proxyUrl;
    }
}
