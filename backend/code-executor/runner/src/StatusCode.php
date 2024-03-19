<?php

declare(strict_types=1);

/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeRunnerBwrap;

enum StatusCode: int
{
    case OK = 1000;
    case ERROR = 1001;
    case INVALID_PARAMS = 5000;
    case EXECUTE_FAILED = 1002001;
    case EXECUTE_TIMEOUT = 1002002;
}
