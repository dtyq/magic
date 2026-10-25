<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception;

use RuntimeException;
use Throwable;

/**
 * 用户已经提交回答，但原执行环境需要恢复后仍未能继续处理。
 *
 * 该异常由消息订阅层转换成页面提示，不应被转换成整条话题的 ERROR 状态。
 */
class UserToolCallRecoveryException extends RuntimeException
{
    public function __construct(string $message, ?Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }
}
