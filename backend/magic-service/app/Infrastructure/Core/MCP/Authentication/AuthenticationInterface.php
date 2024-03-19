<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Authentication;

use App\Infrastructure\Core\MCP\Exception\InvalidParamsException;
use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

/**
 * MCP身份验证接口.
 */
interface AuthenticationInterface
{
    /**
     * 验证请求的身份信息.
     *
     * @throws InvalidParamsException 当验证失败时抛出
     */
    public function authenticate(MessageInterface $request): void;
}
