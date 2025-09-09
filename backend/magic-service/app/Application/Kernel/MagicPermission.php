<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use App\Application\Kernel\Enum\MagicAdminResourceEnum;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Exception;
use InvalidArgumentException;

class MagicPermission implements MagicPermissionInterface
{
    // ========== 全局权限 ==========
    public const string ALL_PERMISSIONS = MagicAdminResourceEnum::ORGANIZATION_ADMIN->value;

    /**
     * 获取所有操作类型.
     */
    public function getOperations(): array
    {
        return array_map(static fn (MagicOperationEnum $op) => $op->value, MagicOperationEnum::cases());
    }

    /**
     * 获取所有资源.
     */
    public function getResources(): array
    {
        return array_map(static fn (MagicResourceEnum $res) => $res->value, MagicResourceEnum::cases());
    }

    /**
     * 获取资源的国际化标签（由 MagicResourceEnum 提供）.
     */
    public function getResourceLabel(string $resource): string
    {
        $enum = MagicResourceEnum::tryFrom($resource);
        if (! $enum) {
            throw new InvalidArgumentException('Not a resource type: ' . $resource);
        }

        $translated = $enum->label();
        // 如果语言包缺失，返回的仍然是原始 key，此时抛出异常提醒
        if ($translated === $enum->translationKey()) {
            ExceptionBuilder::throw(PermissionErrorCode::BusinessException, 'Missing i18n for key: ' . $enum->translationKey());
        }

        return $translated;
    }

    /**
     * 构建完整权限标识.
     */
    public function buildPermission(string $resource, string $operation): string
    {
        if ($resource === self::ALL_PERMISSIONS) {
            return self::ALL_PERMISSIONS . '.' . $operation;
        }

        if (! in_array($resource, $this->getResources()) || ! in_array($operation, $this->getOperations())) {
            throw new InvalidArgumentException('Invalid resource or operation type');
        }

        return $resource . '.' . $operation;
    }

    /**
     * 解析权限标识.
     */
    public function parsePermission(string $permissionKey): array
    {
        $parts = explode('.', $permissionKey);
        if (count($parts) < 2) {
            throw new InvalidArgumentException('Invalid permission key format');
        }

        $operation = array_pop($parts);
        $resourceKey = implode('.', $parts);

        return [
            'resource' => $resourceKey,
            'operation' => $operation,
        ];
    }

    /**
     * 检查是否为资源类型.
     */
    public function isResource(string $value): bool
    {
        return in_array($value, $this->getResources());
    }

    /**
     * 检查是否为操作类型.
     */
    public function isOperation(string $value): bool
    {
        return in_array($value, $this->getOperations());
    }

    /**
     * 获取操作的国际化标签.
     */
    public function getOperationLabel(string $operation): string
    {
        $enum = MagicOperationEnum::tryFrom($operation);
        if (! $enum) {
            throw new InvalidArgumentException('Not an operation type: ' . $operation);
        }

        $translated = $enum->label();
        if ($translated === $enum->translationKey()) {
            ExceptionBuilder::throw(PermissionErrorCode::BusinessException, 'Missing i18n for key: ' . $enum->translationKey());
        }

        return $translated;
    }

    /**
     * 获取资源的模块.
     */
    public function getResourceModule(string $resource): string
    {
        $enum = MagicResourceEnum::tryFrom($resource);
        if (! $enum) {
            throw new InvalidArgumentException('Not a resource type: ' . $resource);
        }

        // 模块层定义为二级资源（即平台的直接子资源）
        if ($enum->parent() === null) {
            // 顶级资源（平台本身）
            $moduleEnum = $enum;
        } else {
            $parent = $enum->parent();
            if ($parent->parent() === null) {
                // 当前资源已经是二级层级，直接作为模块
                $moduleEnum = $enum;
            } else {
                // 更深层级，模块取父级（二级）
                $moduleEnum = $parent;
            }
        }

        $moduleLabel = $moduleEnum->label();
        if ($moduleLabel === $moduleEnum->translationKey()) {
            // 如果缺失翻译，手动兼容已知模块
            return match ($moduleEnum) {
                MagicResourceEnum::ADMIN_AI => 'AI管理',
                default => $moduleEnum->value,
            };
        }

        return $moduleLabel;
    }

    /**
     * 生成所有可能的权限组合.
     */
    public function generateAllPermissions(): array
    {
        $permissions = [];
        $resources = $this->getResources();
        $operations = $this->getOperations();

        foreach ($resources as $resource) {
            // 仅处理三级及以上资源，过滤平台和模块级
            if (substr_count($resource, '.') < 2) {
                continue;
            }
            foreach ($operations as $operation) {
                $permissionKey = $this->buildPermission($resource, $operation);
                $permissions[] = [
                    'permission_key' => $permissionKey,
                    'resource' => $resource,
                    'operation' => $operation,
                    'resource_label' => $this->getResourceLabel($resource),
                    'operation_label' => $this->getOperationLabel($operation),
                ];
            }
        }

        return $permissions;
    }

    /**
     * 获取层级结构的权限树
     * 生成无限极权限树,规则：根据权限资源字符串（如 Admin.ai.model_management）逐段拆分，逐层构造树。
     *
     * 返回格式：
     * [
     *   [
     *     'label' => '管理后台',
     *     'permission_key' => 'Admin',
     *     'children' => [ ... ]
     *   ],
     * ]
     *
     * @param bool $isPlatformOrganization 是否平台组织；仅当为 true 时，包含 platform 平台的资源树
     */
    public function getPermissionTree(bool $isPlatformOrganization = false): array
    {
        $tree = [];

        foreach ($this->generateAllPermissions() as $permission) {
            // 将资源路径按 '.' 拆分
            $segments = explode('.', $permission['resource']);
            if (count($segments) < 2) {
                // 至少应包含平台 + 资源两级，若不足则跳过
                continue;
            }

            $platformKey = array_shift($segments); // 平台，如 Admin

            // 平台组织独有：非平台组织时，过滤掉 platform 平台的资源
            if ($platformKey === MagicResourceEnum::PLATFORM->value && ! $isPlatformOrganization) {
                continue;
            }
            // 初始化平台根节点
            if (! isset($tree[$platformKey])) {
                $tree[$platformKey] = [
                    'label' => $this->getPlatformLabel($platformKey),
                    'permission_key' => $platformKey,
                    'children' => [],
                ];
            }

            // 自顶向下逐段构造
            $current = &$tree[$platformKey];
            $accumKey = $platformKey;
            foreach ($segments as $index => $segment) {
                $accumKey .= '.' . $segment;
                $isLastSegment = $index === array_key_last($segments);

                // 取 label：第一段使用模块中文名，其余按规则
                $label = match (true) {
                    $index === 0 => $this->getResourceModule($permission['resource']),                // 模块层
                    $isLastSegment => $permission['resource_label'],      // 资源层
                    default => ucfirst($segment),                        // 其他中间层
                };

                // 确保 children 数组存在并检查 segment
                if (! isset($current['children'])) {
                    $current['children'] = [];
                }

                if (! array_key_exists($segment, $current['children'])) {
                    $current['children'][$segment] = [
                        'label' => $label,
                        'permission_key' => $accumKey,
                        'children' => [],
                    ];
                }

                $current = &$current['children'][$segment];
            }

            // 此时 $current 指向资源节点，为其添加操作叶子
            $current['children'][] = [
                'label' => $permission['operation_label'],
                'permission_key' => $permission['permission_key'],
                'full_label' => $permission['resource_label'] . '-' . $permission['operation_label'],
                'is_leaf' => true,
            ];
        }

        // 将关联数组 children 转为索引数组，保持返回格式
        return array_values($this->normalizeTree($tree));
    }

    /**
     * 检查权限键是否有效.
     */
    public function isValidPermission(string $permissionKey): bool
    {
        // 全局权限特殊处理
        if ($permissionKey === self::ALL_PERMISSIONS) {
            return true;
        }

        try {
            $parsed = $this->parsePermission($permissionKey);

            // 检查资源是否存在
            $resourceExists = in_array($parsed['resource'], $this->getResources());

            // 检查操作是否存在
            $operationExists = in_array($parsed['operation'], $this->getOperations());

            return $resourceExists && $operationExists;
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * 判断用户权限集合中是否拥有指定权限（考虑隐式包含）。
     *
     * 规则：
     *   1. 如直接命中权限键，返回 true；
     *   2. 如果拥有全局权限 ALL_PERMISSIONS，返回 true；
     *   3. 若未命中，则检查由该权限隐式包含的权限集合（例如 *edit* 隐式包含 *query*）。
     *
     * @param string $permissionKey 目标权限键
     * @param string[] $userPermissions 用户已拥有的权限键集合
     * @param bool $isPlatformOrganization 是否平台组织
     */
    public function checkPermission(string $permissionKey, array $userPermissions, bool $isPlatformOrganization = false): bool
    {
        // 平台组织校验：非平台组织不允许访问 platform 平台资源
        $parsed = $this->parsePermission($permissionKey);
        $platformKey = explode('.', $parsed['resource'])[0];
        if ($platformKey === MagicResourceEnum::PLATFORM->value && ! $isPlatformOrganization) {
            return false;
        }

        // 命中全局权限直接放行
        if (in_array(self::ALL_PERMISSIONS, $userPermissions, true)) {
            return true;
        }

        // 直接命中
        if (in_array($permissionKey, $userPermissions, true)) {
            return true;
        }

        $parsed = $this->parsePermission($permissionKey);
        if ($parsed['operation'] === MagicOperationEnum::QUERY->value) {
            // edit 权限隐式包含 query 权限
            $permissionKey = $this->buildPermission($parsed['resource'], MagicOperationEnum::EDIT->value);
            if (in_array($permissionKey, $userPermissions, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 递归将 child map 转为索引数组.
     */
    private function normalizeTree(array $branch): array
    {
        foreach ($branch as &$node) {
            if (isset($node['children']) && is_array($node['children'])) {
                $node['children'] = array_values($this->normalizeTree($node['children']));
            }
        }
        return $branch;
    }

    /**
     * 根据平台 key 获取显示名称，可按需扩展.
     */
    private function getPlatformLabel(string $platformKey): string
    {
        $enum = MagicResourceEnum::tryFrom($platformKey);
        if ($enum) {
            $label = $enum->label();
            if ($label !== $enum->translationKey()) {
                return $label;
            }
        }

        return ucfirst($platformKey);
    }
}
