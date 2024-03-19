<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Exception;

use Throwable;

class InvalidParamsException extends MCPException
{
    /**
     * JSON-RPC错误码.
     */
    protected int $rpcCode = -32602;

    public function __construct(string $message = 'Invalid params', int $code = 0, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
