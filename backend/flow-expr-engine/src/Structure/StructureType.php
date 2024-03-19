<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure;

enum StructureType: string
{
    case Form = 'form';
    case Widget = 'widget';
    case Condition = 'condition';
    case Expression = 'expression';
    case Api = 'api';
    case Value = 'value';

    public function isForm(): bool
    {
        return $this === self::Form;
    }

    public function isWidget(): bool
    {
        return $this === self::Widget;
    }

    public function isCondition(): bool
    {
        return $this === self::Condition;
    }

    public function isExpression(): bool
    {
        return $this === self::Expression;
    }

    public function isApi(): bool
    {
        return $this === self::Api;
    }

    public function isValue(): bool
    {
        return $this === self::Value;
    }
}
