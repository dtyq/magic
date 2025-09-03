<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\HighAvailability\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\CircuitBreakerStatus;

/**
 * 用于在业务流程中同时保存业务ID和高可用组件接入点数据库ID.
 */
class EndpointDTO extends AbstractDTO
{
    /**
     * getEndpointList 接口返回的 id。
     * 不同的业务含义不同。对于模型网关来说，这里的 id 是 service_provider_models 表的 id。
     * 前端可能不支持 bigint，所以这里用 string.
     */
    protected ?string $businessId = null;

    /**
     * 数据库接入点ID（高可用表主键）.
     */
    protected ?string $endpointId = null;

    /**
     * 接入点类型.
     */
    protected string $type;

    /**
     * 提供商.
     */
    protected ?string $provider = null;

    /**
     * 接入点名称.
     */
    protected string $name;

    /**
     * 配置信息.
     */
    protected ?string $config = null;

    /**
     * 资源的消耗的 id 列表. 一次请求可能会消耗多个资源。
     * @var null|string[]
     */
    protected ?array $resources = null;

    /**
     * 接入点是否启用.
     */
    protected bool $enabled = true;

    /**
     * 熔断状态.
     */
    protected CircuitBreakerStatus $circuitBreakerStatus;

    /**
     * 负载均衡权重(0-100).
     */
    protected ?int $loadBalancingWeight = null;

    /**
     * 创建时间.
     */
    protected string $createdAt;

    /**
     * 更新时间.
     */
    protected string $updatedAt;

    public function __construct($data = [])
    {
        parent::__construct($data);
    }

    // 原有 EndpointDTO 的所有方法
    public function getResources(): ?array
    {
        return $this->resources ?? null;
    }

    public function setResources(null|array|string $resources): static
    {
        if (is_string($resources)) {
            $resources = json_decode($resources, true);
        }
        $this->resources = $resources;
        return $this;
    }

    public function getType(): string
    {
        return $this->type ?? '';
    }

    public function setType(string $type): static
    {
        $this->type = $type;
        return $this;
    }

    public function getProvider(): ?string
    {
        return $this->provider;
    }

    public function setProvider(?string $provider): static
    {
        $this->provider = $provider;
        return $this;
    }

    public function getName(): string
    {
        return $this->name ?? '';
    }

    public function setName(string $name): static
    {
        $this->name = $name;
        return $this;
    }

    public function getConfig(): ?string
    {
        return $this->config;
    }

    public function setConfig(?string $value): static
    {
        $this->config = $value;
        return $this;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt ?? '';
    }

    public function setCreatedAt(string $createdAt): static
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt ?? '';
    }

    public function setUpdatedAt(string $updatedAt): static
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getCircuitBreakerStatus(): CircuitBreakerStatus
    {
        return $this->circuitBreakerStatus;
    }

    public function setCircuitBreakerStatus(CircuitBreakerStatus|string $circuitBreakerStatus): void
    {
        if (is_string($circuitBreakerStatus)) {
            $this->circuitBreakerStatus = CircuitBreakerStatus::fromString($circuitBreakerStatus);
            return;
        }
        $this->circuitBreakerStatus = $circuitBreakerStatus;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    /**
     * 设置接入点是否启用.
     * @param bool|int|string $enabled 可传入布尔值、整数或字符串
     */
    public function setEnabled(bool|int|string $enabled): static
    {
        if (is_numeric($enabled)) {
            $this->enabled = (bool) $enabled;
        } else {
            $this->enabled = $enabled;
        }
        return $this;
    }

    // 新增的增强字段方法
    /**
     * 获取数据库接入点ID.
     */
    public function getEndpointId(): ?string
    {
        return $this->endpointId;
    }

    /**
     * 设置数据库接入点ID.
     */
    public function setEndpointId(null|int|string $endpointId): static
    {
        if (is_int($endpointId)) {
            $endpointId = (string) $endpointId;
        }
        $this->endpointId = $endpointId;
        return $this;
    }

    /**
     * 获取业务ID.
     */
    public function getBusinessId(): ?string
    {
        return $this->businessId;
    }

    /**
     * 设置业务ID.
     */
    public function setBusinessId(null|int|string $businessId): static
    {
        if (is_int($businessId)) {
            $businessId = (string) $businessId;
        }
        $this->businessId = $businessId;
        return $this;
    }

    /**
     * 检查是否存在于数据库中.
     */
    public function hasEndpointId(): bool
    {
        return $this->endpointId !== null && $this->endpointId !== '';
    }

    /**
     * 获取负载均衡权重.
     */
    public function getLoadBalancingWeight(): ?int
    {
        return $this->loadBalancingWeight;
    }

    /**
     * 设置负载均衡权重.
     */
    public function setLoadBalancingWeight(?int $loadBalancingWeight): static
    {
        $this->loadBalancingWeight = $loadBalancingWeight;
        return $this;
    }
}
