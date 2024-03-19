<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Kernel\Exceptions;

use Dtyq\EasyDingTalk\Kernel\Constants\ErrorCode;
use Throwable;

class BadRequestException extends EasyDingTalkException
{
    public function __construct(string $message = '', int $code = ErrorCode::BAD_REQUEST, ?Throwable $throwable = null)
    {
        $message = "[{$code}][BadRequest]{$message}";
        parent::__construct($message, $code, $throwable);
    }
}
