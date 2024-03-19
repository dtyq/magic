<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\RateLimiter;

use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

/**
 * 无限制的速率限制器实现.
 * 对任何请求都不进行限制，适用于对性能要求较高或处于开发阶段的系统.
 */
class NoRateLimiter extends AbstractRateLimiter
{
    /**
     * 是否启用速率限制.
     */
    protected bool $enabled = false;

    /**
     * 获取当前的限制配置.
     * 对于无限制实现，所有限制均设为 PHP_INT_MAX.
     */
    public function getLimits(): array
    {
        return [
            'enabled' => false,
            'rpm' => PHP_INT_MAX,
            'rph' => PHP_INT_MAX,
            'rpd' => PHP_INT_MAX,
        ];
    }

    /**
     * 无限制的检查实现，始终允许请求通过.
     */
    protected function doCheck(string $clientId, MessageInterface $request): void
    {
        // 空实现，始终允许请求通过
    }
}
