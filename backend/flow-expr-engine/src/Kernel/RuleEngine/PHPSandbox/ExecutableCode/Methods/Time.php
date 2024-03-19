<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods;

class Time extends AbstractMethod
{
    protected string $code = 'time';

    protected string $name = '返回当前的 Unix 时间戳';

    protected string $returnType = 'int';

    protected string $group = '内置函数';

    protected string $desc = '返回自从 Unix 纪元（格林威治时间 1970 年 1 月 1 日 00:00:00）到当前时间的秒数。';

    protected array $args = [];
}
