<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Exception;

use RuntimeException;
use Throwable;

/**
 * 沙箱操作异常类
 * 用于统一处理沙箱相关操作的异常.
 */
class SandboxOperationException extends RuntimeException
{
    public function __construct(string $operation, string $message, int $code = 0, ?Throwable $previous = null)
    {
        parent::__construct(sprintf('%s failed: %s', $operation, $message), $code, $previous);
    }
}
