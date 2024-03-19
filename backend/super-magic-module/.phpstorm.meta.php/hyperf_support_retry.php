<?php

declare(strict_types=1);

namespace Hyperf\Support;

use Throwable;

/**
 * @template TReturn
 *
 * @param int $times
 * @param callable(int $attempt, Throwable|null $exception): TReturn $callback
 * @param int $sleep
 *
 * @return TReturn
 */
function retry(int $times, callable $callback, int $sleep = 0)
{
}

