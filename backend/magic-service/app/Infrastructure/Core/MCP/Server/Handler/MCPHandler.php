<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Handler;

use App\Infrastructure\Core\MCP\Authentication\AuthenticationInterface;
use App\Infrastructure\Core\MCP\Authentication\NoAuthentication;
use App\Infrastructure\Core\MCP\Exception\Handler\MCPExceptionHandler;
use App\Infrastructure\Core\MCP\Prompts\MCPPromptManager;
use App\Infrastructure\Core\MCP\RateLimiter\NoRateLimiter;
use App\Infrastructure\Core\MCP\RateLimiter\RateLimiterInterface;
use App\Infrastructure\Core\MCP\Resources\MCPResourceManager;
use App\Infrastructure\Core\MCP\Server\Handler\Method\MethodHandlerFactory;
use App\Infrastructure\Core\MCP\Tools\MCPToolManager;
use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;
use App\Infrastructure\Core\MCP\Types\Message\Response;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

class MCPHandler implements MCPHandlerInterface
{
    protected MCPExceptionHandler $exceptionHandler;

    protected AuthenticationInterface $authentication;

    protected RateLimiterInterface $rateLimiter;

    protected LoggerInterface $logger;

    protected MCPToolManager $toolManager;

    protected MCPResourceManager $resourceManager;

    protected MCPPromptManager $promptManager;

    protected MethodHandlerFactory $methodHandlerFactory;

    public function __construct(
        protected ContainerInterface $container,
    ) {
        $this->logger = $this->container->get(LoggerFactory::class)->get('MCPHandler');
        $this->exceptionHandler = $this->container->get(MCPExceptionHandler::class);
        $this->methodHandlerFactory = new MethodHandlerFactory($this->container);

        // 初始化默认组件
        $this->authentication = new NoAuthentication();
        $this->rateLimiter = new NoRateLimiter();
        $this->toolManager = new MCPToolManager();
        $this->resourceManager = new MCPResourceManager();
        $this->promptManager = new MCPPromptManager();
    }

    /**
     * 获取认证接口实例.
     */
    public function getAuthentication(): AuthenticationInterface
    {
        return $this->authentication;
    }

    /**
     * 设置认证接口实例.
     */
    public function setAuthentication(AuthenticationInterface $authentication): self
    {
        $this->authentication = $authentication;
        return $this;
    }

    /**
     * 获取速率限制器实例.
     */
    public function getRateLimiter(): RateLimiterInterface
    {
        return $this->rateLimiter;
    }

    /**
     * 设置速率限制器实例.
     */
    public function setRateLimiter(RateLimiterInterface $rateLimiter): self
    {
        $this->rateLimiter = $rateLimiter;
        return $this;
    }

    /**
     * 获取工具管理器实例.
     */
    public function getToolManager(): MCPToolManager
    {
        return $this->toolManager;
    }

    /**
     * 设置工具管理器实例.
     */
    public function setToolManager(MCPToolManager $toolManager): self
    {
        $this->toolManager = $toolManager;
        return $this;
    }

    /**
     * 获取资源管理器实例.
     */
    public function getResourceManager(): MCPResourceManager
    {
        return $this->resourceManager;
    }

    /**
     * 设置资源管理器实例.
     */
    public function setResourceManager(MCPResourceManager $resourceManager): self
    {
        $this->resourceManager = $resourceManager;
        return $this;
    }

    /**
     * 获取提示管理器实例.
     */
    public function getPromptManager(): MCPPromptManager
    {
        return $this->promptManager;
    }

    /**
     * 设置提示管理器实例.
     */
    public function setPromptManager(MCPPromptManager $promptManager): self
    {
        $this->promptManager = $promptManager;
        return $this;
    }

    public function handle(MessageInterface $request): ?MessageInterface
    {
        try {
            $clientId = $this->getClientId($request);
            $this->getRateLimiter()->check($clientId, $request);

            $this->getAuthentication()->authenticate($request);

            // 获取请求的方法名称
            $method = $request->getMethod();

            // 创建处理器实例（短生命周期）
            $handler = $this->methodHandlerFactory->createHandler($method);

            $result = null;
            if ($handler) {
                // 为处理器设置所需的管理器组件
                $handler->setToolManager($this->toolManager)
                    ->setResourceManager($this->resourceManager)
                    ->setPromptManager($this->promptManager);

                $result = $handler->handle($request);
            } else {
                $this->logger->warning('UnknownMethodIgnored', ['method' => $method]);
            }
            if (is_null($result)) {
                return null;
            }

            return new Response($request->getId(), $request->getJsonRpc(), $result);
        } catch (Throwable $e) {
            return $this->exceptionHandler->handle($e, $request->getId(), $request->getJsonRpc());
        }
    }

    /**
     * 获取客户端唯一标识.
     */
    protected function getClientId(MessageInterface $request): string
    {
        $params = $request->getParams() ?? [];

        // 尝试从认证信息中获取
        if (isset($params['auth'], $params['auth']['client_id'])) {
            return $params['auth']['client_id'];
        }

        // 回退到会话ID
        if (isset($params['sessionId'])) {
            return $params['sessionId'];
        }

        // 如果都没有，则使用请求ID
        return (string) $request->getId();
    }
}
