<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\Contract;

/**
 * 权限标签提供者接口.
 * Domain层定义，Infrastructure层实现.
 */
interface PermissionLabelProviderInterface
{
    /**
     * 获取资源标签.
     */
    public function getResourceLabel(string $resourceCode): string;

    /**
     * 获取资源标签路径（三级拼接）.
     */
    public function getResourceLabelPath(string $resourceCode): string;

    /**
     * 获取操作标签.
     */
    public function getOperationLabel(string $operationCode): string;

    /**
     * 获取按资源的操作标签.
     */
    public function getOperationLabelByResource(string $resourceCode, string $operationCode): string;
}
