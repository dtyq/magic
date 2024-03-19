<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Exception;

use RuntimeException;

class MCPException extends RuntimeException
{
    /**
     * JSON-RPC错误码.
     */
    protected int $rpcCode = -32000;

    /**
     * 获取JSON-RPC错误码.
     */
    public function getRpcCode(): int
    {
        return $this->rpcCode;
    }

    /**
     * 设置JSON-RPC错误码.
     */
    public function setRpcCode(int $code): self
    {
        $this->rpcCode = $code;
        return $this;
    }
}
