<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\Date;

use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\AbstractMethod;

class GetISO8601Date extends AbstractMethod
{
    protected string $code = 'get_iso8601_date';

    protected string $name = 'get_iso8601_date';

    protected string $returnType = 'string';

    protected string $group = '日期/时间';

    protected string $desc = '获取ISO 8601格式的日期（仅日期部分）;如：2021-01-01';

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
            return date('Y-m-d', $time);
        };
    }
}
