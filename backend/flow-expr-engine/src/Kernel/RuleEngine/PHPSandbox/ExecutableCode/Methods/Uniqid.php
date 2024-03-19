<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods;

class Uniqid extends AbstractMethod
{
    protected string $code = 'uniqid';

    protected string $name = '生成一个唯一 ID';

    protected string $returnType = 'string';

    protected string $group = '内置函数';

    protected string $desc = '生成一个唯一 ID';

    protected array $args = [
        [
            'name' => 'prefix',
            'desc' => '有用的参数。例如：如果在多台主机上可能在同一微秒生成唯一ID。\n prefix为空，则返回的字符串长度为 13。more_entropy 为 true，则返回的字符串长度为 23。',
            'type' => 'string',
        ],
        [
            'name' => 'more_entropy',
            'desc' => '如果设置为 true，uniqid() 会在返回的字符串结尾增加额外的熵（使用线性同余组合发生器）。 使得唯一ID更具唯一性。',
            'type' => 'bool',
        ],
    ];
}
