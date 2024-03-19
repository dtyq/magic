<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Util\StringMaskUtil;

abstract class AbstractProviderConfigItem extends AbstractDTO
{
    protected string $url = '';

    /**
     * API Key (很多服务商都用，所以放在基类，但不是必须).
     */
    protected string $apiKey = '';

    /**
     * 是否开启代理.
     */
    protected bool $useProxy = false;

    /**
     * 代理配置 ["id"=>'代理ID'].
     */
    protected array $proxyServer = [];

    /**
     * 模型版本.
     */
    protected string $modelVersion = '';

    /**
     * service_provider_models.id 模型ID.
     */
    protected string $providerModelId = '';

    /**
     * 优先级.
     */
    protected ?int $priority = null;

    public function getUrl(): string
    {
        return $this->url;
    }

    public function setUrl(null|int|string $url): void
    {
        if ($url === null) {
            $this->url = '';
        } else {
            $this->url = (string) $url;
        }
    }

    public function getUseProxy(): bool
    {
        return $this->useProxy;
    }

    public function setUseProxy(bool $useProxy): void
    {
        $this->useProxy = $useProxy;
    }

    public function getProxyServer(): array
    {
        return $this->proxyServer;
    }

    public function setProxyServer(array $proxyServer): void
    {
        $this->proxyServer = $proxyServer;
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

    public function getPriority(): ?int
    {
        return $this->priority;
    }

    public function setPriority(?int $priority): void
    {
        $this->priority = $priority;
    }

    public function getApiKey(): string
    {
        return $this->apiKey;
    }

    public function setApiKey(null|int|string $apiKey): void
    {
        if ($apiKey === null) {
            $this->apiKey = '';
        } else {
            $this->apiKey = (string) $apiKey;
        }
    }

    /**
     * 对敏感字段进行脱敏处理.
     */
    public function maskSensitiveFields(): void
    {
        $sensitiveFields = $this->getSensitiveFields();

        foreach ($sensitiveFields as $field) {
            $value = $this->get($field);

            if (is_string($value) && ! empty($value)) {
                $this->set($field, StringMaskUtil::mask($value));
            }
        }
    }

    /**
     * 获取需要脱敏的字段列表.
     *
     * @return array<string>
     */
    public function getSensitiveFields(): array
    {
        return ['apiKey'];
    }

    /**
     * 从旧配置中还原脱敏数据.
     */
    public function restoreFromMasked(array $oldConfig): void
    {
        $sensitiveFields = $this->getSensitiveFields();

        foreach ($sensitiveFields as $field) {
            $newValue = $this->get($field);

            // 检查是否为脱敏后的格式（前3位+星号+后3位）
            if (is_string($newValue) && preg_match('/^.{3}\*+.{3}$/', $newValue)) {
                // 尝试从旧配置中获取原始值
                // 优先尝试驼峰命名
                $oldValue = $oldConfig[$field] ?? null;

                // 如果没找到，尝试蛇形命名
                if ($oldValue === null) {
                    $snakeField = $this->getUnCamelizeValueFromCache($field);
                    $oldValue = $oldConfig[$snakeField] ?? null;
                }

                if ($oldValue !== null) {
                    $this->set($field, $oldValue);
                }
            }
        }
    }

    /**
     * 判断配置是否为空（所有需要检查的字段都是空值）.
     */
    public function isEmpty(): bool
    {
        return empty($this->getApiKey())
               && empty($this->getUrl());
    }
}
