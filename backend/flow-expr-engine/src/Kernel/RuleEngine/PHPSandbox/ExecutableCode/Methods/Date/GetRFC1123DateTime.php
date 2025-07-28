<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\Date;

use DateTime;
use DateTimeZone;
use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\AbstractMethod;

class GetRFC1123DateTime extends AbstractMethod
{
    protected string $code = 'get_rfc1123_date_time';

    protected string $name = 'get_rfc1123_date_time';

    protected string $returnType = 'string';

    protected string $group = '日期/时间';

    protected string $desc = '获取RFC 1123格式的日期和时间;如：Sat, 21 Oct 2021 07:28:00 GMT';

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

            // Create DateTime object from timestamp and set to UTC
            $datetime = new DateTime('@' . $time);
            $datetime->setTimezone(new DateTimeZone('UTC'));

            // Format as RFC 1123 with proper GMT suffix
            return $datetime->format('D, d M Y H:i:s') . ' GMT';
        };
    }
}
