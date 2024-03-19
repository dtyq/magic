<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Tools;

class MCPToolManager
{
    /**
     * @var array<string, MCPTool>
     */
    private array $tools = [];

    /**
     * 注册工具.
     */
    public function registerTool(MCPTool $tool): void
    {
        $this->tools[$tool->getName()] = $tool;
    }

    /**
     * 获取所有注册的工具.
     *
     * @return array<string, MCPTool>
     */
    public function getTools(): array
    {
        return $this->tools;
    }

    /**
     * 获取工具列表的Schema形式.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getToolSchemas(): array
    {
        $schemas = [];
        foreach ($this->tools as $tool) {
            $schemas[] = $tool->toScheme();
        }
        return $schemas;
    }

    /**
     * 获取指定名称的工具.
     */
    public function getTool(string $name): ?MCPTool
    {
        return $this->tools[$name] ?? null;
    }

    /**
     * 检查指定名称的工具是否存在.
     */
    public function hasTool(string $name): bool
    {
        return isset($this->tools[$name]);
    }

    /**
     * 检查是否没有任何工具.
     */
    public function isEmpty(): bool
    {
        return empty($this->tools);
    }
}
