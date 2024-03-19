<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods;

class MtRand extends AbstractMethod
{
    protected string $code = 'mt_rand';

    protected string $name = '生成随机整数';

    protected string $returnType = 'int|false';

    protected string $group = '内置函数';

    protected string $desc = '通过梅森旋转（Mersenne Twister）随机数生成器生成随机值';

    protected array $args = [
        [
            'name' => 'min',
            'desc' => '可选的、返回的最小值（默认：0）',
            'type' => 'int',
        ],
        [
            'name' => 'max',
            'desc' => '可选的、返回的最大值（默认：mt_getrandmax()）',
            'type' => 'int',
        ],
    ];
}
