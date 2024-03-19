<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\PHPSandbox\ExecutableCode\Methods;

use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\AbstractMethod;

class LogicalIfMethod extends AbstractMethod
{
    protected string $code = 'logical_if';

    protected string $name = 'logical_if';

    protected string $returnType = 'mixed';

    protected string $group = '逻辑';

    protected string $desc = '根据指定的条件来返回不同的结果';

    protected array $args = [
        [
            'name' => 'logical',
            'type' => 'bool',
            'desc' => '逻辑',
        ],
        [
            'name' => 'trueValue',
            'type' => 'mixed',
            'desc' => '逻辑为真时的返回值',
        ],
        [
            'name' => 'falseValue',
            'type' => 'mixed',
            'desc' => '逻辑为假时的返回值',
        ],
    ];

    public function getFunction(): ?callable
    {
        return function (bool $logical, mixed $trueValue = '', mixed $falseValue = ''): mixed {
            return $logical ? $trueValue : $falseValue;
        };
    }
}
