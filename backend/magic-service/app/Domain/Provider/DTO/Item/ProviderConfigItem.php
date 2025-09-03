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

    public function setAk(int|string|null $ak): void
    {
        if ($ak === null) {
            $this->ak = '';
        } else {
            $this->ak = (string) $ak;
        }
    }

    public function setSk(int|string|null $sk): void
    {
        if ($sk === null) {
            $this->sk = '';
        } else {
            $this->sk = (string) $sk;
        }
    }

    public function setApiKey(int|string|null $apiKey): void
    {
        if ($apiKey === null) {
            $this->apiKey = '';
        } else {
            $this->apiKey = (string) $apiKey;
        }
    }

    public function setUrl(int|string|null $url): void
    {
        if ($url === null) {
            $this->url = '';
        } else {
            $this->url = (string) $url;
        }
    }

    public function setProxyUrl(int|string|null $proxyUrl): void
    {
        if ($proxyUrl === null) {
            $this->proxyUrl = '';
        } else {
            $this->proxyUrl = (string) $proxyUrl;
        }
    }

    public function setApiVersion(int|string|null $apiVersion): void
    {
        if ($apiVersion === null) {
            $this->apiVersion = '';
        } else {
            $this->apiVersion = (string) $apiVersion;
        }
    }

    public function setDeploymentName(int|string|null $deploymentName): void
    {
        if ($deploymentName === null) {
            $this->deploymentName = '';
        } else {
            $this->deploymentName = (string) $deploymentName;
        }
    }

    public function setRegion(int|string|null $region): void
    {
        if ($region === null) {
            $this->region = '';
        } else {
            $this->region = (string) $region;
        }
    }
}
