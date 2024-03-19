<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Resources;

/**
 * MCP资源管理器.
 * 当前版本为空实现，仅返回空列表.
 */
class MCPResourceManager
{
    /**
     * @var array<string, array<string, mixed>>
     */
    private array $resources = [];

    /**
     * 注册资源.
     * 当前为空实现.
     */
    public function registerResource(array $resource): void
    {
        // 空实现，暂不注册任何资源
    }

    /**
     * 获取资源列表.
     * 当前为空实现，返回空数组.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getResources(): array
    {
        return [];
    }

    /**
     * 获取指定ID的资源.
     * 当前为空实现，始终返回null.
     */
    public function getResource(string $id): ?array
    {
        return null;
    }

    /**
     * 检查指定ID的资源是否存在.
     */
    public function hasResource(string $id): bool
    {
        return isset($this->resources[$id]);
    }

    /**
     * 检查是否没有任何资源.
     */
    public function isEmpty(): bool
    {
        return empty($this->resources);
    }
}
