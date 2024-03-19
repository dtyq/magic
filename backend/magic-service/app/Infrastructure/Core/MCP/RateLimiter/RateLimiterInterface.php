<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\RateLimiter;

use App\Infrastructure\Core\MCP\Exception\InvalidParamsException;
use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

/**
 * 速率限制器接口.
 */
interface RateLimiterInterface
{
    /**
     * 检查客户端是否允许执行请求.
     *
     * @throws InvalidParamsException 当请求超过速率限制时
     */
    public function check(string $clientId, MessageInterface $request): void;

    /**
     * 获取当前的限制配置.
     *
     * @return array<string, bool|int> 包含限制配置的数组
     */
    public function getLimits(): array;
}
