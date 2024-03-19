<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Form;

enum FormType: string
{
    case String = 'string';
    case Number = 'number';
    case Integer = 'integer';
    case Boolean = 'boolean';
    case Array = 'array';
    case Object = 'object';
    case Expression = 'expression';

    public function isBasic(): bool
    {
        return in_array($this, [FormType::String, FormType::Number, FormType::Boolean, FormType::Integer, FormType::Expression]);
    }

    public function isComplex(): bool
    {
        return in_array($this, [FormType::Array, FormType::Object]);
    }

    public function isObject(): bool
    {
        return $this == FormType::Object;
    }

    public function isArray(): bool
    {
        return $this == FormType::Array;
    }
}
