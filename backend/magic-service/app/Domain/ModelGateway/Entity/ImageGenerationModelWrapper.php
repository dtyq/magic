<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;

/**
 * 图片生成模型包装器.
 *
 * 用于统一图片生成模型的处理，使其能够与 processRequest 流程兼容
 */
readonly class ImageGenerationModelWrapper
{
    public function __construct(
        private string $modelId,
        private string $modelVersion,
        private array $serviceProviderConfigs,
        private string $organizationCode,
    ) {
    }

    /**
     * 获取服务提供商配置数组.
     * @return ProviderConfigItem[] 服务商配置数组
     */
    public function getServiceProviderConfigs(): array
    {
        return $this->serviceProviderConfigs;
    }

    /**
     * 获取模型ID.
     */
    public function getModelId(): string
    {
        return $this->modelId;
    }

    /**
     * 获取组织代码
     */
    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    /**
     * 获取"模型".
     *
     * 为了兼容 processRequest 中的逻辑，返回自身
     * 这样后续的处理可以通过 instanceof 判断来区分处理
     */
    public function getModel(): self
    {
        return $this;
    }

    /**
     * 检查是否有可用的服务提供商配置.
     */
    public function hasServiceProviders(): bool
    {
        return ! empty($this->serviceProviderConfigs);
    }

    /**
     * 获取第一个服务提供商配置（用于快速访问）.
     */
    public function getFirstServiceProviderConfig(): ?array
    {
        return $this->serviceProviderConfigs[0] ?? null;
    }

    /**
     * 获取服务提供商数量.
     */
    public function getServiceProviderCount(): int
    {
        return count($this->serviceProviderConfigs);
    }
}
