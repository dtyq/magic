<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\Date;

use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\AbstractMethod;

class GetISO8601DateTimeWithOffset extends AbstractMethod
{
    protected string $code = 'get_iso8601_date_time_with_offset';

    protected string $name = 'get_iso8601_date_time_with_offset';

    protected string $returnType = 'string';

    protected string $group = '日期/时间';

    protected string $desc = '获取带时区偏移的ISO 8601格式的日期和时间;如：2021-01-01T00:00:00+08:00';

    protected array $args = [
        [
            'name' => 'time',
            'type' => 'int',
            'desc' => '要计算的时间戳。默认当前时间',
        ],
    ];

    public function getFunction(): ?callable
    {
        return function (int|string|null $time = null): string {
            $time = $time ?? time();
            if (is_string($time)) {
                $time = strtotime($time) ?: time();
            }
            $timezoneOffset = date('P', $time);
            return date('Y-m-d\TH:i:s', $time) . $timezoneOffset;
        };
    }
}
