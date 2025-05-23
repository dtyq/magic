<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Handler\Method;

use InvalidArgumentException;
use Psr\Container\ContainerInterface;

/**
 * MCP方法处理器工厂.
 */
class MethodHandlerFactory
{
    /**
     * 方法处理器映射，方法名 => 处理器类名.
     *
     * @var array<string, class-string<MethodHandlerInterface>>
     */
    private static array $methodHandlerMap = [
        'initialize' => InitializeHandler::class,
        'tools/call' => ToolCallHandler::class,
        'tools/list' => ToolListHandler::class,
        'resources/list' => ResourceListHandler::class,
        'resources/read' => ResourceReadHandler::class,
        'prompts/list' => PromptListHandler::class,
        'prompts/get' => PromptGetHandler::class,
        'notifications/initialized' => NotificationInitializedHandler::class,
        'notifications/cancelled' => NotificationCancelledHandler::class,
        'ping' => PingHandler::class,
    ];

    public function __construct(
        private readonly ContainerInterface $container
    ) {
    }

    /**
     * 创建指定方法的处理器实例.
     * 每次调用都创建新的处理器实例，确保短生命周期.
     * 注意：调用者需要手动为返回的处理器设置所需的Manager组件.
     *
     * @return null|MethodHandlerInterface 如果找不到对应方法的处理器则返回null
     */
    public function createHandler(string $method): ?MethodHandlerInterface
    {
        if (! $this->hasHandler($method)) {
            return null;
        }

        $handlerClass = self::$methodHandlerMap[$method];

        return new $handlerClass($this->container);
    }

    /**
     * 检查是否存在指定方法的处理器.
     */
    public function hasHandler(string $method): bool
    {
        return isset(self::$methodHandlerMap[$method]);
    }

    /**
     * 获取所有支持的方法.
     *
     * @return array<string>
     */
    public function getMethods(): array
    {
        return array_keys(self::$methodHandlerMap);
    }

    /**
     * 注册自定义方法处理器.
     *
     * @param string $method 方法名
     * @param class-string<MethodHandlerInterface> $handlerClass 处理器类名
     */
    public function registerCustomHandler(string $method, string $handlerClass): void
    {
        if (! is_subclass_of($handlerClass, MethodHandlerInterface::class)) {
            throw new InvalidArgumentException(
                "Handler class {$handlerClass} must implement MethodHandlerInterface"
            );
        }

        self::$methodHandlerMap[$method] = $handlerClass;
    }
}
