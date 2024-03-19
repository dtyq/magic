<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods;

class Md5 extends AbstractMethod
{
    protected string $code = 'md5';

    protected string $name = '计算字符串的 MD5 散列值';

    protected string $returnType = 'string';

    protected string $group = '内置函数';

    protected string $desc = '计算字符串的 MD5 散列值';

    protected array $args = [
        [
            'name' => 'string',
            'type' => 'string',
            'desc' => '要计算的字符串。',
        ],
        [
            'name' => 'binary',
            'type' => 'boolean',
            'desc' => '如果可选的 binary 被设置为 true，那么 md5 摘要将以 16 字符长度的原始二进制格式返回。',
        ],
    ];
}
