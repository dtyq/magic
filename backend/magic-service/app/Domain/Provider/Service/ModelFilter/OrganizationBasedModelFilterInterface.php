<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service\ModelFilter;

use App\Domain\Provider\Entity\ProviderModelEntity;

/**
 * 基于组织编码的模型过滤服务接口.
 *
 * 用于替代基于模型表 visiblePackages 字段的过滤逻辑
 * 企业包实现此接口，提供给开源包进行模型过滤
 */
interface OrganizationBasedModelFilterInterface
{
    /**
     * 基于组织编码过滤模型列表
     * 这是企业包提供给开源包的核心过滤方法.
     *
     * @param string $organizationCode 组织编码
     * @param array $models 待过滤的模型列表 [modelId => ProviderModelEntity]
     * @return array 过滤后的模型列表 [modelId => ProviderModelEntity]
     */
    public function filterModelsByOrganization(string $organizationCode, array $models): array;

    /**
     * 检查指定模型是否对组织可用.
     *
     * @param string $organizationCode 组织编码
     * @param string $modelIdentifier 模型标识符 (如: gpt-4o)
     * @return bool 是否可用
     */
    public function isModelAvailableForOrganization(string $organizationCode, string $modelIdentifier): bool;

    /**
     * 获取组织当前订阅产品绑定的所有模型标识符.
     *
     * @param string $organizationCode 组织编码
     * @return array 模型标识符数组，例如: ['gpt-4o', 'claude-3', ...]
     */
    public function getAvailableModelIdentifiers(string $organizationCode): array;
}
