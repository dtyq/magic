<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Kernel\Exceptions;

use Dtyq\EasyDingTalk\Kernel\Constants\ErrorCode;
use Throwable;

class InvalidConfigException extends EasyDingTalkException
{
    public function __construct(string $message = '无效配置', int $code = ErrorCode::INVALID_CONFIG, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
