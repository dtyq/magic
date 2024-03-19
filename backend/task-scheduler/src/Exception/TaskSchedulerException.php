<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Exception;

use RuntimeException;
use Throwable;

class TaskSchedulerException extends RuntimeException
{
    public function __construct(?string $message = null, int $code = 500, ?Throwable $previous = null)
    {
        // $message = '[ScheduleTaskException]' . ($message ?? '');
        parent::__construct($message, $code, $previous);
    }
}
