<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Exception;

use Throwable;

class MethodNotFoundException extends MCPException
{
    /**
     * JSON-RPC错误码.
     */
    protected int $rpcCode = -32601;

    public function __construct(string $message = 'Method not found', int $code = 0, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
