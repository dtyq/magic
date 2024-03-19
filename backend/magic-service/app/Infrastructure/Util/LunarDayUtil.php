<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

use Overtrue\ChineseCalendar\Calendar;

class LunarDayUtil
{
    public static function convertToLunarDay(string $date): string
    {
        $dateParts = explode('-', $date);
        // 创建日历对象
        /* @phpstan-ignore-next-line */
        $lunarInfo = (new Calendar())->solar($dateParts[0], $dateParts[1], $dateParts[2]);
        return $lunarInfo['lunar_day_chinese']; // 返回农历天数
    }
}
