<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Entity\ValueObject;

use App\Infrastructure\Core\AbstractDTO;

class ServiceProviderConfig extends AbstractDTO
{
    protected string $ak = '';

    protected string $sk = '';

    protected string $apiKey = '';

    protected string $url = '';

    protected string $proxyUrl = '';

    protected string $apiVersion = '';

    protected string $deploymentName = '';

    protected string $region = '';

    public function getApiVersion(): string
    {
        return $this->apiVersion;
    }

    public function setApiVersion(string $apiVersion): void
    {
        $this->apiVersion = $apiVersion;
    }

    public function getDeploymentName(): string
    {
        return $this->deploymentName;
    }

    public function setDeploymentName(string $deploymentName): void
    {
        $this->deploymentName = $deploymentName;
    }

    public function getAk(): string
    {
        return $this->ak;
    }

    public function setAk(string $ak): void
    {
        $this->ak = $ak;
    }

    public function getSk(): string
    {
        return $this->sk;
    }

    public function setSk(string $sk): void
    {
        $this->sk = $sk;
    }

    public function getApiKey(): string
    {
        return $this->apiKey;
    }

    public function setApiKey(string $apiKey): void
    {
        $this->apiKey = $apiKey;
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function setUrl(string $url): void
    {
        $this->url = $url;
    }

    public function getProxyUrl(): string
    {
        return $this->proxyUrl;
    }

    public function setProxyUrl(string $proxyUrl): void
    {
        $this->proxyUrl = $proxyUrl;
    }

    public function getRegion(): string
    {
        return $this->region;
    }

    public function setRegion(string $region): void
    {
        $this->region = $region;
    }
}
