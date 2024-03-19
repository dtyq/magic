<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Audit\Permission;

use App\Domain\Audit\Contract\PermissionLabelProviderInterface;
use App\Domain\Audit\Contract\PermissionLabelServiceInterface;
use Throwable;

/**
 * 权限标签提供者实现.
 * Infrastructure层实现Domain层接口，通过依赖注入获取权限标签服务.
 *
 * 架构说明：
 * 1. 本类实现Domain层的PermissionLabelProviderInterface接口
 * 2. 依赖Domain层的PermissionLabelServiceInterface接口（同属Audit模块）
 * 3. 通过构造函数注入，遵循依赖注入原则
 * 4. 符合DDD分层架构：Infrastructure层 → Domain层接口 ← Application层实现
 */
class PermissionLabelProvider implements PermissionLabelProviderInterface
{
    public function __construct(
        private readonly PermissionLabelServiceInterface $permissionLabelService
    ) {
    }

    /**
     * 获取资源标签.
     * 通过Domain层接口调用，符合DDD分层原则.
     */
    public function getResourceLabel(string $resourceCode): string
    {
        try {
            return $this->permissionLabelService->getResourceLabel($resourceCode);
        } catch (Throwable $e) {
            // 获取失败时返回资源代码本身
            return $resourceCode;
        }
    }

    /**
     * 获取资源标签路径（三级拼接）.
     * 通过Domain层接口调用，符合DDD分层原则.
     */
    public function getResourceLabelPath(string $resourceCode): string
    {
        try {
            return $this->permissionLabelService->getResourceLabelPath($resourceCode);
        } catch (Throwable $e) {
            return $resourceCode;
        }
    }

    /**
     * 获取操作标签.
     * 通过Domain层接口调用，符合DDD分层原则.
     */
    public function getOperationLabel(string $operationCode): string
    {
        try {
            return $this->permissionLabelService->getOperationLabel($operationCode);
        } catch (Throwable $e) {
            // 获取失败时使用简单映射
            $operationLabelMap = [
                'query' => '查看',
                'edit' => '编辑',
            ];
            return $operationLabelMap[$operationCode] ?? $operationCode;
        }
    }

    /**
     * 获取按资源的操作标签.
     */
    public function getOperationLabelByResource(string $resourceCode, string $operationCode): string
    {
        try {
            return $this->permissionLabelService->getOperationLabelByResource($resourceCode, $operationCode);
        } catch (Throwable $e) {
            return $this->getOperationLabel($operationCode);
        }
    }
}
