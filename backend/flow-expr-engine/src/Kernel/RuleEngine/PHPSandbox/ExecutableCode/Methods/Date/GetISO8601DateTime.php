<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\Date;

use DateTime;
use DateTimeZone;
use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\AbstractMethod;

class GetISO8601DateTime extends AbstractMethod
{
    protected string $code = 'get_iso8601_date_time';

    protected string $name = 'get_iso8601_date_time';

    protected string $returnType = 'string';

    protected string $group = '日期/时间';

    protected string $desc = '获取ISO 8601格式的日期和时间（UTC时间）;如：2021-01-01T00:00:00Z';

    protected array $args = [
        [
            'name' => 'time',
            'type' => 'int',
            'desc' => '要计算的时间戳。默认当前时间',
        ],
    ];

    public function getFunction(): ?callable
    {
        return function (null|int|string $time = null): string {
            $time = $time ?? time();
            if (is_string($time)) {
                $time = strtotime($time) ?: time();
            }

            // Create DateTime object from timestamp and convert to UTC
            $datetime = new DateTime('@' . $time);
            $datetime->setTimezone(new DateTimeZone('UTC'));

            // Format as ISO 8601 with UTC timezone (Z suffix)
            return $datetime->format('Y-m-d\TH:i:s\Z');
        };
    }
}
