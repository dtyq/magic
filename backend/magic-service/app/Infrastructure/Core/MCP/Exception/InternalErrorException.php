<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Exception;

use Throwable;

class InternalErrorException extends MCPException
{
    /**
     * JSON-RPC错误码.
     */
    protected int $rpcCode = -32603;

    public function __construct(string $message = 'Internal error', int $code = 0, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
