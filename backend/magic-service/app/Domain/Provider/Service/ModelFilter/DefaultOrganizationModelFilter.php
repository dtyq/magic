<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service\ModelFilter;

/**
 * 默认的组织模型过滤器实现.
 *
 * 不进行任何过滤，直接返回原始模型列表
 * 用于开源版本或企业包未配置时的回退方案
 */
class DefaultOrganizationModelFilter implements OrganizationBasedModelFilterInterface
{
    /**
     * 默认实现：不进行过滤，返回所有传入的模型.
     */
    public function filterModelsByOrganization(string $organizationCode, array $models): array
    {
        return $models;
    }

    /**
     * 默认实现：所有模型都可用.
     */
    public function isModelAvailableForOrganization(string $organizationCode, string $modelIdentifier): bool
    {
        return true;
    }

    /**
     * 默认实现：返回空数组，表示没有特定的模型绑定.
     */
    public function getAvailableModelIdentifiers(string $organizationCode): array
    {
        return [];
    }
}
