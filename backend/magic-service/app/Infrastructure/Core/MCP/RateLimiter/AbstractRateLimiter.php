<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\RateLimiter;

use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

/**
 * 抽象速率限制器基类.
 */
abstract class AbstractRateLimiter implements RateLimiterInterface
{
    /**
     * 每分钟最大请求数.
     */
    protected int $maxRequestsPerMinute = 60;

    /**
     * 每小时最大请求数.
     */
    protected int $maxRequestsPerHour = 1000;

    /**
     * 每天最大请求数.
     */
    protected int $maxRequestsPerDay = 5000;

    /**
     * 是否启用速率限制.
     */
    protected bool $enabled = true;

    /**
     * 检查客户端是否允许执行请求.
     */
    public function check(string $clientId, MessageInterface $request): void
    {
        if (! $this->enabled) {
            return;
        }

        // 初始化请求不进行限制
        if ($request->getMethod() === 'initialize') {
            return;
        }

        // 执行具体的速率限制检查
        $this->doCheck($clientId, $request);
    }

    /**
     * 获取当前的限制配置.
     */
    public function getLimits(): array
    {
        return [
            'enabled' => $this->enabled,
            'rpm' => $this->maxRequestsPerMinute,
            'rph' => $this->maxRequestsPerHour,
            'rpd' => $this->maxRequestsPerDay,
        ];
    }

    /**
     * 实际执行的速率限制检查.
     * 由子类实现具体逻辑.
     */
    abstract protected function doCheck(string $clientId, MessageInterface $request): void;
}
