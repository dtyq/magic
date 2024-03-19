<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Time;

class TimeUtil
{
    // 根据传入的开始时间，返回与当前时间的毫秒级时间差
    public static function getMillisecondDiffFromNow(float $startTime): int
    {
        return (int) ((microtime(true) - $startTime) * 1000);
    }
}
