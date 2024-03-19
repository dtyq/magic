<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Coroutine;

use Swow\Coroutine;

class SwowCoroutineRun
{
    public static function syncRun(callable $callable, mixed &$result, int $maxTime = 10): bool
    {
        $coroutine = Coroutine::run(function () use ($callable, &$result) {
            $result = $callable();
        });

        while ($coroutine->isAlive()) {
            usleep(1000);
            if ($coroutine->getElapsed() > $maxTime * 1000) {
                $coroutine->kill();
                return false;
            }
        }

        return true;
    }
}
