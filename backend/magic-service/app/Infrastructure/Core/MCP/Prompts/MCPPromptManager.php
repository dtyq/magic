<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Prompts;

/**
 * MCP提示管理器.
 * 当前版本为空实现，仅返回空列表.
 */
class MCPPromptManager
{
    /**
     * @var array<string, array<string, mixed>>
     */
    private array $prompts = [];

    /**
     * 注册提示.
     * 当前为空实现.
     */
    public function registerPrompt(array $prompt): void
    {
        // 空实现，暂不注册任何提示
    }

    /**
     * 获取提示列表.
     * 当前为空实现，返回空数组.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getPrompts(): array
    {
        return [];
    }

    /**
     * 获取指定ID的提示.
     * 当前为空实现，始终返回null.
     */
    public function getPrompt(string $id): ?array
    {
        return null;
    }

    /**
     * 检查指定ID的提示是否存在.
     */
    public function hasPrompt(string $id): bool
    {
        return isset($this->prompts[$id]);
    }

    /**
     * 检查是否没有任何提示.
     */
    public function isEmpty(): bool
    {
        return empty($this->prompts);
    }
}
