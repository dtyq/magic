<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine;

enum IntervalUnit: string
{
    /**
     * 间隔执行单位:天.
     */
    case Day = 'day';

    /**
     * 间隔执行单位:周.
     */
    case Week = 'week';

    /**
     * 间隔执行单位:月.
     */
    case Month = 'month';

    /**
     * 间隔执行单位:年.
     */
    case Year = 'year';
}
