<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Kernel\Exceptions;

use Dtyq\EasyDingTalk\Kernel\Constants\ErrorCode;
use Throwable;

class SystemException extends EasyDingTalkException
{
    public function __construct(string $message = '系统异常', int $code = ErrorCode::SYSTEM, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
