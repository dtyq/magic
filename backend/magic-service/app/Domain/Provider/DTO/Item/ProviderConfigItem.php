<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

use App\Infrastructure\Core\AbstractDTO;

class ProviderConfigItem extends AbstractDTO
{
    protected string $ak = '';

    protected string $sk = '';

    protected string $apiKey = '';

    protected string $url = '';

    protected string $proxyUrl = '';

    protected string $apiVersion = '';

    protected string $deploymentName = '';

    protected string $region = '';

    protected string $modelVersion = '';

    protected string $providerModelId;

    public function getAk(): string
    {
        return $this->ak;
    }

    public function getSk(): string
    {
        return $this->sk;
    }

    public function getApiKey(): string
    {
        return $this->apiKey;
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function getProxyUrl(): string
    {
        return $this->proxyUrl;
    }

    public function getApiVersion(): string
    {
        return $this->apiVersion;
    }

    public function getDeploymentName(): string
    {
        return $this->deploymentName;
    }

    public function getRegion(): string
    {
        return $this->region;
    }

    public function setAk(null|int|string $ak): void
    {
        if ($ak === null) {
            $this->ak = '';
        } else {
            $this->ak = (string) $ak;
        }
    }

    public function setSk(null|int|string $sk): void
    {
        if ($sk === null) {
            $this->sk = '';
        } else {
            $this->sk = (string) $sk;
        }
    }

    public function setApiKey(null|int|string $apiKey): void
    {
        if ($apiKey === null) {
            $this->apiKey = '';
        } else {
            $this->apiKey = (string) $apiKey;
        }
    }

    public function setUrl(null|int|string $url): void
    {
        if ($url === null) {
            $this->url = '';
        } else {
            $this->url = (string) $url;
        }
    }

    public function setProxyUrl(null|int|string $proxyUrl): void
    {
        if ($proxyUrl === null) {
            $this->proxyUrl = '';
        } else {
            $this->proxyUrl = (string) $proxyUrl;
        }
    }

    public function setApiVersion(null|int|string $apiVersion): void
    {
        if ($apiVersion === null) {
            $this->apiVersion = '';
        } else {
            $this->apiVersion = (string) $apiVersion;
        }
    }

    public function setDeploymentName(null|int|string $deploymentName): void
    {
        if ($deploymentName === null) {
            $this->deploymentName = '';
        } else {
            $this->deploymentName = (string) $deploymentName;
        }
    }

    public function setRegion(null|int|string $region): void
    {
        if ($region === null) {
            $this->region = '';
        } else {
            $this->region = (string) $region;
        }
    }

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function setModelVersion(string $modelVersion): void
    {
        $this->modelVersion = $modelVersion;
    }

    public function getProviderModelId(): string
    {
        return $this->providerModelId;
    }

    public function setProviderModelId(string $providerModelId): void
    {
        $this->providerModelId = $providerModelId;
    }
}
