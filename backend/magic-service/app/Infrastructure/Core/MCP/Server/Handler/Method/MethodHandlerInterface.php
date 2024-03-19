<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Handler\Method;

use App\Infrastructure\Core\MCP\Prompts\MCPPromptManager;
use App\Infrastructure\Core\MCP\Resources\MCPResourceManager;
use App\Infrastructure\Core\MCP\Tools\MCPToolManager;
use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

/**
 * MCP方法处理器接口.
 */
interface MethodHandlerInterface
{
    /**
     * 处理请求并返回结果.
     *
     * @return null|array<string, mixed> 处理结果，如果不需要返回数据则返回null
     */
    public function handle(MessageInterface $request): ?array;

    /**
     * 设置工具管理器.
     */
    public function setToolManager(MCPToolManager $toolManager): self;

    /**
     * 获取工具管理器.
     */
    public function getToolManager(): MCPToolManager;

    /**
     * 设置资源管理器.
     */
    public function setResourceManager(MCPResourceManager $resourceManager): self;

    /**
     * 获取资源管理器.
     */
    public function getResourceManager(): MCPResourceManager;

    /**
     * 设置提示管理器.
     */
    public function setPromptManager(MCPPromptManager $promptManager): self;

    /**
     * 获取提示管理器.
     */
    public function getPromptManager(): MCPPromptManager;
}
