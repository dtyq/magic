<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods;

class StrContains extends AbstractMethod
{
    protected string $code = 'str_contains';

    protected string $name = '确定字符串是否包含指定子串';

    protected string $returnType = 'boolean';

    protected string $group = '内置函数';

    protected string $desc = '执行大小写区分的检查，表明 needle 是否包含在 haystack 中。';

    protected array $args = [
        [
            'name' => 'haystack',
            'type' => 'string',
            'desc' => '在其中搜索的字符串。',
        ],
        [
            'name' => 'needle',
            'type' => 'string',
            'desc' => '要在 haystack 中搜索的子串。',
        ],
    ];
}
