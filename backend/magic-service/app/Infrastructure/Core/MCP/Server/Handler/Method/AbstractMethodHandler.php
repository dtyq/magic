<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Handler\Method;

use App\Infrastructure\Core\MCP\Exception\InternalErrorException;
use App\Infrastructure\Core\MCP\Prompts\MCPPromptManager;
use App\Infrastructure\Core\MCP\Resources\MCPResourceManager;
use App\Infrastructure\Core\MCP\Tools\MCPToolManager;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

/**
 * MCP方法处理器抽象基类.
 */
abstract class AbstractMethodHandler implements MethodHandlerInterface
{
    protected LoggerInterface $logger;

    private MCPToolManager $toolManager;

    private MCPResourceManager $resourceManager;

    private MCPPromptManager $promptManager;

    public function __construct(
        protected ContainerInterface $container
    ) {
        $this->logger = $this->container->get(LoggerFactory::class)
            ->get('MCPMethodHandler');
    }

    /**
     * 设置工具管理器.
     */
    public function setToolManager(MCPToolManager $toolManager): self
    {
        $this->toolManager = $toolManager;
        return $this;
    }

    /**
     * 获取工具管理器.
     * @throws InternalErrorException 当工具管理器未设置时抛出
     */
    public function getToolManager(): MCPToolManager
    {
        if (! isset($this->toolManager)) {
            throw new InternalErrorException('工具管理器(ToolManager)未设置');
        }
        return $this->toolManager;
    }

    /**
     * 设置资源管理器.
     */
    public function setResourceManager(MCPResourceManager $resourceManager): self
    {
        $this->resourceManager = $resourceManager;
        return $this;
    }

    /**
     * 获取资源管理器.
     * @throws InternalErrorException 当资源管理器未设置时抛出
     */
    public function getResourceManager(): MCPResourceManager
    {
        if (! isset($this->resourceManager)) {
            throw new InternalErrorException('资源管理器(ResourceManager)未设置');
        }
        return $this->resourceManager;
    }

    /**
     * 设置提示管理器.
     */
    public function setPromptManager(MCPPromptManager $promptManager): self
    {
        $this->promptManager = $promptManager;
        return $this;
    }

    /**
     * 获取提示管理器.
     * @throws InternalErrorException 当提示管理器未设置时抛出
     */
    public function getPromptManager(): MCPPromptManager
    {
        if (! isset($this->promptManager)) {
            throw new InternalErrorException('提示管理器(PromptManager)未设置');
        }
        return $this->promptManager;
    }
}
