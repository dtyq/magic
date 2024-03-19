<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods;

class Round extends AbstractMethod
{
    protected string $code = 'round';

    protected string $name = '四舍五入';

    protected string $returnType = 'float';

    protected string $group = '内置函数';

    protected string $desc = '返回num的四舍五入值到指定的精度(小数点后的位数)。';

    protected array $args = [
        [
            'name' => 'num',
            'type' => 'int|float',
            'desc' => '要进行四舍五入的值。',
        ],
        [
            'name' => 'precision',
            'type' => 'int',
            'desc' => "要四舍五入的可选小数位数。\n如果精度为正，则将num四舍五入到小数点后的精度",
        ],
    ];
}
