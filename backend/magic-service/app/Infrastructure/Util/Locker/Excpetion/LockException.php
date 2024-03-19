<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Locker\Excpetion;

use Exception;
use Throwable;

class LockException extends Exception
{
    public function __construct(string $message = 'lock failed', int $code = 500, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
