<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Expression;

enum ValueType: string
{
    case Const = 'const';
    case Expression = 'expression';
}
