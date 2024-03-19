<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Exception;

use Throwable;

class TaskSchedulerBusinessException extends TaskSchedulerException
{
    public function __construct(?string $message = null, int $code = 400, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
