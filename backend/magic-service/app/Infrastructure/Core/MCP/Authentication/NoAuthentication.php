<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Authentication;

use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

/**
 * 无认证实现.
 * 当系统设计要求有身份验证但不需要实际验证时使用.
 */
class NoAuthentication implements AuthenticationInterface
{
    /**
     * 验证请求的身份信息.
     * 在此实现中，始终允许所有请求通过.
     */
    public function authenticate(MessageInterface $request): void
    {
        // 空实现，始终允许所有请求通过
    }
}
