<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine;

enum RoutineType: string
{
    /**
     * 不重复.
     */
    case NoRepeat = 'no_repeat';

    /**
     * 每天重复.
     */
    case DailyRepeat = 'daily_repeat';

    /**
     * 每周重复.
     */
    case WeeklyRepeat = 'weekly_repeat';

    /**
     * 每月重复.
     */
    case MonthlyRepeat = 'monthly_repeat';

    /**
     * 每年重复.
     */
    case AnnuallyRepeat = 'annually_repeat';

    /**
     * 每个工作日重复.
     */
    case WeekdayRepeat = 'weekday_repeat';

    /**
     * 自定义重复.
     */
    case CustomRepeat = 'custom_repeat';

    public function needDay(): bool
    {
        return in_array($this, [
            self::NoRepeat,
            self::MonthlyRepeat,
            self::AnnuallyRepeat,
            self::CustomRepeat,
        ]);
    }

    public function needTime(): bool
    {
        return in_array($this, [
            self::NoRepeat,
            self::DailyRepeat,
            self::WeeklyRepeat,
            self::MonthlyRepeat,
            self::AnnuallyRepeat,
            self::CustomRepeat,
        ]);
    }
}
