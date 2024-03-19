<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Entity\ValueObject;

enum TaskSchedulerStatus: int
{
    case Unknown = 0;
    case Pending = 1;
    case Running = 2;
    case Success = 3;
    case Failed = 4;
    case Canceled = 5;
    case Timeout = 6;
    case Retry = 7;
}
