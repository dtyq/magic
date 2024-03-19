<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\Service;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Domain\Audit\Contract\PermissionLabelServiceInterface;
use Throwable;

use function Hyperf\Translation\__;

/**
 * 权限标签服务实现.
 * Application层实现Domain层接口，作为适配器调用MagicPermissionInterface.
 *
 * 设计说明：
 * 1. 本类属于Audit模块的Application层服务
 * 2. 实现Domain层的PermissionLabelServiceInterface接口
 * 3. 内部调用历史代码MagicPermissionInterface（不修改历史代码）
 * 4. 作为适配器，将历史代码适配到DDD架构中
 * 5. 通过此适配器，使Infrastructure层可以间接使用Application层服务
 */
class PermissionLabelService implements PermissionLabelServiceInterface
{
    public function __construct(
        private readonly MagicPermissionInterface $magicPermission
    ) {
    }

    /**
     * 获取资源标签.
     *
     * 内部调用MagicPermissionInterface，如果获取失败则返回资源代码本身.
     * 采用try-catch确保不会因为权限服务异常而影响日志记录.
     */
    public function getResourceLabel(string $resourceCode): string
    {
        try {
            return $this->magicPermission->getResourceLabel($resourceCode);
        } catch (Throwable $e) {
            $label = $this->resolveResourceLabelFromI18n(str_replace('.', '_', $resourceCode));
            return $label ?? $resourceCode;
        }
    }

    /**
     * 获取资源标签路径（三级拼接）.
     *
     * 基于 MagicResourceEnum / EnterpriseResourceEnum 的 parent() 反向回溯拼接，
     * 未知资源或缺失 i18n 时降级为资源编码本身.
     */
    public function getResourceLabelPath(string $resourceCode): string
    {
        $enum = MagicResourceEnum::tryFrom($resourceCode);
        if (! $enum) {
            $segments = array_values(array_filter(explode('.', $resourceCode)));
            if ($segments === []) {
                return $resourceCode;
            }

            $labels = [];
            $accumKey = '';
            foreach ($segments as $segment) {
                $accumKey = $accumKey === '' ? $segment : $accumKey . '.' . $segment;
                $i18nKey = str_replace('.', '_', $accumKey);
                $labels[] = $this->resolveResourceLabelFromI18n($i18nKey) ?? $accumKey;
            }

            return implode('-', $labels);
        }

        $labels = [];
        $current = $enum;
        while ($current !== null) {
            $labels[] = $this->getResourceLabel($current->value);
            $current = $current->parent();
        }

        $labels = array_reverse($labels);
        return implode('-', $labels);
    }

    /**
     * 获取操作标签.
     *
     * 内部调用MagicPermissionInterface，如果获取失败则使用默认映射.
     * 采用try-catch确保不会因为权限服务异常而影响日志记录.
     */
    public function getOperationLabel(string $operationCode): string
    {
        try {
            return $this->magicPermission->getOperationLabel($operationCode);
        } catch (Throwable $e) {
            // 获取失败时使用简单映射
            $operationLabelMap = [
                'query' => '查看',
                'edit' => '编辑',
                'create' => '创建',
                'delete' => '删除',
            ];
            return $operationLabelMap[$operationCode] ?? $operationCode;
        }
    }

    /**
     * 获取按资源的操作标签.
     *
     * 内部优先使用按资源解析的操作枚举，失败则降级为通用操作映射.
     */
    public function getOperationLabelByResource(string $resourceCode, string $operationCode): string
    {
        try {
            if (method_exists($this->magicPermission, 'getOperationLabelByResource')) {
                return call_user_func(
                    [$this->magicPermission, 'getOperationLabelByResource'],
                    $resourceCode,
                    $operationCode
                );
            }
            return $this->magicPermission->getOperationLabel($operationCode);
        } catch (Throwable $e) {
            return $this->getOperationLabel($operationCode);
        }
    }

    private function resolveResourceLabelFromI18n(string $resourceKey): ?string
    {
        $i18nKeys = [
            "permission.resource.{$resourceKey}",
            "permission_enterprise.resource.{$resourceKey}",
        ];

        foreach ($i18nKeys as $i18nKey) {
            try {
                $label = __($i18nKey);
            } catch (Throwable) {
                continue;
            }
            if ($label !== $i18nKey) {
                return $label;
            }
        }

        return null;
    }
}
