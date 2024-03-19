<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Exception;

use Throwable;

class SecurityException extends MCPException
{
    /**
     * JSON-RPC错误码.
     * 使用自定义错误码范围: -32000 到 -32099.
     */
    protected int $rpcCode = -32050;

    public function __construct(string $message = 'Security constraint violation', int $code = 0, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
