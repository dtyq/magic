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
use BackedEnum;
use Exception;
use InvalidArgumentException;

class MagicPermission implements MagicPermissionInterface
{
    // ========== 全局权限 ==========
    public const string ALL_PERMISSIONS = MagicAdminResourceEnum::ORGANIZATION_ADMIN->value;

    // ========== 个人组织管理员权限组 ==========
    public const string PERSON_PERMISSIONS = MagicAdminResourceEnum::PERSONAL_ORGANIZATION_ADMIN->value;

    // ========== 平台组织管理员权限组 ==========
    public const string PLATFORM_PERMISSIONS = MagicAdminResourceEnum::PLATFORM_ORGANIZATION_ADMIN->value;

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
        if ($this->isPermissionGroupResource($resource)) {
            return $resource . '.' . $operation;
        }

        if (! in_array($resource, $this->getResources()) || ! in_array($operation, $this->getOperationsByResource($resource), true)) {
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

        // 新菜单下优先使用映射配置的分组标签（向上兼容：不改 permission_key）
        $mappedTag = $this->getMappedResourceTag($resource);
        if ($mappedTag !== null) {
            return $mappedTag;
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
            foreach ($this->getOperationsByResource($resource) as $operation) {
                $permissionKey = $this->buildPermission($resource, $operation);
                $permissions[] = [
                    'permission_key' => $permissionKey,
                    'resource' => $resource,
                    'operation' => $operation,
                    'resource_label' => $this->getResourceLabel($resource),
                    'operation_label' => $this->getOperationLabelByResource($resource, $operation),
                ];
            }
        }

        return $permissions;
    }

    /**
     * 获取层级结构的权限树
     * 生成无限极权限树,规则：根据权限资源字符串（如 workspace.ai.model_management）逐段拆分，逐层构造树。
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
            $segments = explode('.', $permission['resource']);
            if (count($segments) < 2) {
                continue;
            }

            $platformKey = $segments[0];

            if ($platformKey === MagicResourceEnum::PLATFORM->value && ! $isPlatformOrganization) {
                continue;
            }

            $pathNodeSets = $this->resolvePermissionPathNodeSets($permission);
            if ($pathNodeSets === []) {
                continue;
            }

            foreach ($pathNodeSets as $pathNodes) {
                $this->appendPermissionToTree($tree, $pathNodes, $permission);
            }
        }

        return array_values($this->normalizeTree($tree));
    }

    /**
     * 检查权限键是否有效.
     */
    public function isValidPermission(string $permissionKey): bool
    {
        // 权限组常量特殊处理
        if (
            $permissionKey === self::ALL_PERMISSIONS
            || $permissionKey === self::PERSON_PERMISSIONS
            || $permissionKey === self::PLATFORM_PERMISSIONS
        ) {
            return true;
        }

        try {
            $parsed = $this->parsePermission($permissionKey);

            // 检查资源是否存在
            $resourceExists = in_array($parsed['resource'], $this->getResources());

            // 检查操作是否存在（按资源）
            $operationExists = in_array($parsed['operation'], $this->getOperationsByResource($parsed['resource']), true);

            return $resourceExists && $operationExists;
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * 判断用户权限集合中是否拥有指定权限（考虑隐式包含）。
     *
     * 规则：
     *   1. 非平台组织访问 platform.* 资源，直接拒绝；
     *   2. 权限组包含关系：PERSON ⊂ ALL ⊂ PLATFORM；
     *   3. PLATFORM 允许 admin/workspace/platform；
     *   4. ALL 允许 admin/workspace；
     *   5. PERSON 仅允许 workspace；
     *   6. 若未命中，再检查直接权限与隐式包含（edit -> query）。
     *
     * @param string $permissionKey 目标权限键
     * @param string[] $userPermissions 用户已拥有的权限键集合
     * @param bool $isPlatformOrganization 是否平台组织
     */
    public function checkPermission(string $permissionKey, array $userPermissions, bool $isPlatformOrganization = false): bool
    {
        $parsed = $this->parsePermission($permissionKey);
        $resource = $parsed['resource'];

        // 非平台组织不允许访问 platform.* 资源
        if ($this->isPlatformResource($resource) && ! $isPlatformOrganization) {
            return false;
        }

        // 权限组资源键判定（支持组包含关系，兼容注解写法）
        if ($this->isPermissionGroupResource($resource)) {
            if ($this->checkPermissionGroupForGroupResource($resource, $userPermissions)) {
                return true;
            }

            // 兼容：若数据库里存了带 operation 的权限组键，允许直接命中
            return in_array($permissionKey, $userPermissions, true);
        }

        // 权限组对普通资源判定
        if ($this->checkPermissionGroupForResource($resource, $userPermissions)) {
            return true;
        }

        // 直接命中
        if (in_array($permissionKey, $userPermissions, true)) {
            return true;
        }

        // 默认隐式：edit -> query（若两操作均存在）
        $ops = $this->getOperationsByResource($resource);
        if (in_array(MagicOperationEnum::EDIT->value, $ops, true) && in_array(MagicOperationEnum::QUERY->value, $ops, true)) {
            if ($parsed['operation'] === MagicOperationEnum::QUERY->value) {
                $permissionKey = $this->buildPermission($resource, MagicOperationEnum::EDIT->value);
                if (in_array($permissionKey, $userPermissions, true)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 获取按资源的操作标签。
     */
    public function getOperationLabelByResource(string $resource, string $operation): string
    {
        $enum = MagicResourceEnum::tryFrom($resource);
        $opEnumClass = $enum
            ? $this->resolveOperationEnumClass($enum)
            : $this->resolveOperationEnumClassFromUnknownResource($resource);
        if (method_exists($opEnumClass, 'tryFrom')) {
            $opEnum = $opEnumClass::tryFrom($operation);
            if (! $opEnum) {
                throw new InvalidArgumentException('Not an operation type: ' . $operation);
            }
            // 要求自定义 OperationEnum 实现 label()/translationKey() 与 MagicOperationEnum 对齐
            if (method_exists($opEnum, 'label') && method_exists($opEnum, 'translationKey')) {
                $translated = $opEnum->label();
                // 缺失 i18n 时降级为操作值，避免报错中断
                return $translated === $opEnum->translationKey() ? $operation : $translated;
            }
            // 兼容：若未实现 label/translationKey，则退回通用 getOperationLabel 逻辑
        }
        return $this->getOperationLabel($operation);
    }

    /**
     * 解析资源绑定的 Operation Enum，返回该资源可用的操作集合（字符串数组）。
     */
    protected function getOperationsByResource(string $resource): array
    {
        $enum = MagicResourceEnum::tryFrom($resource);
        $opEnumClass = $enum
            ? $this->resolveOperationEnumClass($enum)
            : $this->resolveOperationEnumClassFromUnknownResource($resource);
        if (! enum_exists($opEnumClass)) {
            throw new InvalidArgumentException('Operation enum not found for resource: ' . $resource);
        }
        // 仅支持 BackedEnum，因为后续需要读取 ->value
        if (! is_subclass_of($opEnumClass, BackedEnum::class)) {
            throw new InvalidArgumentException('Operation enum for resource must be BackedEnum: ' . $opEnumClass);
        }

        /** @var class-string<BackedEnum> $opEnumClass */
        $cases = $opEnumClass::cases();
        /* @var array<int, \BackedEnum> $cases */
        return array_map(static fn (BackedEnum $case) => $case->value, $cases);
    }

    /**
     * 返回资源绑定的 Operation Enum 类名，默认读取 `MagicResourceEnum::operationEnumClass()`。
     * 企业版可覆盖本方法，将企业资源映射到自定义的 Operation Enum。
     */
    protected function resolveOperationEnumClass(MagicResourceEnum $resourceEnum): string
    {
        return $resourceEnum->operationEnumClass();
    }

    /**
     * 对于非 MagicResourceEnum 定义的资源，子类可覆盖该方法以解析到相应的 Operation Enum。
     * 开源默认抛错。
     */
    protected function resolveOperationEnumClassFromUnknownResource(string $resource): string
    {
        throw new InvalidArgumentException('Not a resource type: ' . $resource);
    }

    private function isWorkspaceResource(string $resource): bool
    {
        return $resource === MagicResourceEnum::WORKSPACE->value
            || str_starts_with($resource, MagicResourceEnum::WORKSPACE->value . '.');
    }

    private function isAdminResource(string $resource): bool
    {
        return $resource === MagicResourceEnum::ADMIN->value
            || str_starts_with($resource, MagicResourceEnum::ADMIN->value . '.');
    }

    private function isPlatformResource(string $resource): bool
    {
        return $resource === MagicResourceEnum::PLATFORM->value
            || str_starts_with($resource, MagicResourceEnum::PLATFORM->value . '.');
    }

    private function isPermissionGroupResource(string $resource): bool
    {
        return in_array($resource, [
            self::PERSON_PERMISSIONS,
            self::ALL_PERMISSIONS,
            self::PLATFORM_PERMISSIONS,
        ], true);
    }

    /**
     * 权限组资源键判定（PERSON ⊂ ALL ⊂ PLATFORM）。
     *
     * @param string[] $userPermissions
     */
    private function checkPermissionGroupForGroupResource(string $targetGroupResource, array $userPermissions): bool
    {
        return match ($targetGroupResource) {
            self::PERSON_PERMISSIONS => in_array(self::PERSON_PERMISSIONS, $userPermissions, true)
                || in_array(self::ALL_PERMISSIONS, $userPermissions, true)
                || in_array(self::PLATFORM_PERMISSIONS, $userPermissions, true),
            self::ALL_PERMISSIONS => in_array(self::ALL_PERMISSIONS, $userPermissions, true)
                || in_array(self::PLATFORM_PERMISSIONS, $userPermissions, true),
            self::PLATFORM_PERMISSIONS => in_array(self::PLATFORM_PERMISSIONS, $userPermissions, true),
            default => false,
        };
    }

    /**
     * 普通资源上的权限组判定。
     *
     * @param string[] $userPermissions
     */
    private function checkPermissionGroupForResource(string $resource, array $userPermissions): bool
    {
        if (in_array(self::PLATFORM_PERMISSIONS, $userPermissions, true)) {
            if ($this->isAdminResource($resource) || $this->isWorkspaceResource($resource) || $this->isPlatformResource($resource)) {
                return true;
            }
        }

        if (in_array(self::ALL_PERMISSIONS, $userPermissions, true)) {
            if ($this->isAdminResource($resource) || $this->isWorkspaceResource($resource)) {
                return true;
            }
        }

        if (in_array(self::PERSON_PERMISSIONS, $userPermissions, true) && $this->isWorkspaceResource($resource)) {
            return true;
        }

        return false;
    }

    /**
     * 解析权限在树中的路径节点（优先使用菜单映射配置，未命中则回退旧逻辑）。
     *
     * @param array{permission_key:string,resource:string,resource_label:string,operation_label:string} $permission
     * @return array<int, array<int, array{index_key:string,label:string,permission_key:string}>>
     */
    private function resolvePermissionPathNodeSets(array $permission): array
    {
        $mappedPaths = $this->getMappedResourcePaths($permission['resource']);
        if ($mappedPaths !== []) {
            $pathNodeSets = [];
            foreach ($mappedPaths as $mappedPath) {
                $pathNodes = $this->buildMappedPathNodes($mappedPath);
                if ($pathNodes !== []) {
                    $pathNodeSets[] = $pathNodes;
                }
            }

            if ($pathNodeSets !== []) {
                return $pathNodeSets;
            }
        }

        // 默认不回退旧树，避免新旧结构同时返回。
        // 仅在映射配置整体缺失（或显式开启回退）时才启用旧逻辑兜底。
        if (! $this->shouldUseLegacyTreeFallback()) {
            return [];
        }

        // 旧逻辑：按资源路径切分层级构树
        $segments = explode('.', $permission['resource']);
        if (count($segments) < 2) {
            return [];
        }

        $platformKey = array_shift($segments);
        $accumKey = $platformKey;
        $pathNodes = [[
            'index_key' => $platformKey,
            'label' => $this->getPlatformLabel($platformKey),
            'permission_key' => $platformKey,
        ]];

        foreach ($segments as $index => $segment) {
            $accumKey .= '.' . $segment;
            $isLastSegment = $index === array_key_last($segments);

            $label = match (true) {
                $index === 0 => $this->getResourceModule($permission['resource']),
                $isLastSegment => $permission['resource_label'],
                default => ucfirst($segment),
            };

            $pathNodes[] = [
                'index_key' => $segment,
                'label' => $label,
                'permission_key' => $accumKey,
            ];
        }

        return [$pathNodes];
    }

    /**
     * 是否允许回退到旧版权限树构造逻辑。
     */
    private function shouldUseLegacyTreeFallback(): bool
    {
        if ((bool) config('permission_menu.fallback_legacy_tree', false)) {
            return true;
        }

        $mapping = config('permission_menu.resource_menu_mapping', null);
        return ! is_array($mapping) || $mapping === [];
    }

    /**
     * 将一个权限叶子按给定路径挂到树中。
     *
     * @param array<string, array{label:string,permission_key:string,children:array}> $tree
     * @param array<int, array{index_key:string,label:string,permission_key:string}> $pathNodes
     * @param array{permission_key:string,resource:string,resource_label:string,operation_label:string} $permission
     */
    private function appendPermissionToTree(array &$tree, array $pathNodes, array $permission): void
    {
        $current = &$tree;
        foreach ($pathNodes as $node) {
            $indexKey = $node['index_key'];
            if (! isset($current[$indexKey])) {
                $current[$indexKey] = [
                    'label' => $node['label'],
                    'permission_key' => $node['permission_key'],
                    'children' => [],
                ];
            }
            $current = &$current[$indexKey]['children'];
        }

        $leafKey = $permission['permission_key'];
        if (! isset($current[$leafKey])) {
            $current[$leafKey] = [
                'label' => $permission['operation_label'],
                'permission_key' => $permission['permission_key'],
                'full_label' => $permission['resource_label'] . '-' . $permission['operation_label'],
                'is_leaf' => true,
            ];
        }
    }

    /**
     * 获取某 resource 的菜单映射定义。
     */
    private function getResourceMenuMapping(string $resource): ?array
    {
        $mapping = config('permission_menu.resource_menu_mapping', []);
        if (! is_array($mapping)) {
            return null;
        }

        $resourceMapping = $mapping[$resource] ?? null;
        if (! is_array($resourceMapping)) {
            return null;
        }

        return $resourceMapping;
    }

    /**
     * 获取某 resource 映射的菜单路径节点。
     */
    private function getMappedResourcePaths(string $resource): array
    {
        $paths = [];

        $resourceMapping = $this->getResourceMenuMapping($resource);
        if ($resourceMapping !== null) {
            $path = $resourceMapping['path'] ?? null;
            if (is_array($path)) {
                $paths[] = $path;
            }
        }

        $aliasMapping = config('permission_menu.resource_menu_alias_mapping', []);
        if (! is_array($aliasMapping)) {
            return $paths;
        }

        $resourceAliases = $aliasMapping[$resource] ?? null;
        if (! is_array($resourceAliases)) {
            return $paths;
        }

        foreach ($resourceAliases as $resourceAlias) {
            if (! is_array($resourceAlias)) {
                continue;
            }

            $path = $resourceAlias['path'] ?? null;
            if (is_array($path)) {
                $paths[] = $path;
            }
        }

        return $paths;
    }

    /**
     * @param array<int, mixed> $mappedPath
     * @return array<int, array{index_key:string,label:string,permission_key:string}>
     */
    private function buildMappedPathNodes(array $mappedPath): array
    {
        $pathNodes = [];
        $accumKeys = [];
        foreach ($mappedPath as $node) {
            if (! is_array($node)) {
                return [];
            }
            $key = isset($node['key']) ? (string) $node['key'] : '';
            $label = isset($node['label']) ? (string) $node['label'] : '';
            if ($key === '' || $label === '') {
                return [];
            }
            $accumKeys[] = $key;
            $pathNodes[] = [
                'index_key' => $key,
                'label' => $label,
                'permission_key' => 'menu.' . implode('.', $accumKeys),
            ];
        }

        return $pathNodes;
    }

    /**
     * 获取某 resource 在角色列表中展示的 permission_tag。
     */
    private function getMappedResourceTag(string $resource): ?string
    {
        $resourceMapping = $this->getResourceMenuMapping($resource);
        if ($resourceMapping === null) {
            return null;
        }

        $tag = $resourceMapping['tag'] ?? null;
        if (is_string($tag) && $tag !== '') {
            return $tag;
        }

        $path = $resourceMapping['path'] ?? null;
        if (! is_array($path)) {
            return null;
        }

        $secondLevelLabel = $path[1]['label'] ?? null;
        if (is_string($secondLevelLabel) && $secondLevelLabel !== '') {
            return $secondLevelLabel;
        }

        return null;
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
