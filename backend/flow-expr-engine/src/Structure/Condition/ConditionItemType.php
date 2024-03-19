<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Condition;

enum ConditionItemType: string
{
    case Compare = 'compare';
    case Operation = 'operation';
}
