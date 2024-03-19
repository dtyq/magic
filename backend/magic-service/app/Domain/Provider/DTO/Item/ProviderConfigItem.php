<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

class ProviderConfigItem extends AbstractProviderConfigItem
{
    protected string $ak = '';

    protected string $sk = '';

    protected string $apiVersion = '';

    protected string $deploymentName = '';

    protected string $region = '';

    protected string $proxyUrl = '';

    public function getAk(): string
    {
        return $this->ak;
    }

    public function getSk(): string
    {
        return $this->sk;
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

    /**
     * 获取需要脱敏的字段列表.
     *
     * @return array<string>
     */
    public function getSensitiveFields(): array
    {
        return array_merge(parent::getSensitiveFields(), ['ak', 'sk']);
    }

    public function getProxyUrl(): string
    {
        return $this->proxyUrl;
    }

    public function setProxyUrl(null|int|string $proxyUrl): void
    {
        if ($proxyUrl === null) {
            $this->proxyUrl = '';
        } else {
            $this->proxyUrl = (string) $proxyUrl;
        }
    }

    /**
     * 判断配置是否为空（所有需要检查的字段都是空值）.
     */
    public function isEmpty(): bool
    {
        return parent::isEmpty()
               && empty($this->getAk())
               && empty($this->getSk())
               && empty($this->getApiVersion())
               && empty($this->getDeploymentName())
               && empty($this->getRegion())
               && empty($this->getProxyUrl());
    }
}
