<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Expression;

/**
 * 数据类型.
 */
enum DataType: string
{
    case String = 'string';
    case Number = 'number';
    case Array = 'array';
    case Object = 'object';
    case Boolean = 'boolean';
    case Null = 'null';
    case Expression = 'expression';

    public static function make(?string $input = null): ?self
    {
        // integer归类到number
        if ($input == 'integer') {
            $input = 'number';
        }
        return self::tryFrom(strtolower($input ?? ''));
    }

    public static function makeByValue(mixed $value): ?DataType
    {
        $valueType = strtolower(gettype($value));
        if ($valueType === 'array') {
            // 如果不是连续数组，则认为是对象
            if (! empty($value) && array_keys($value) !== range(0, count($value) - 1)) {
                $valueType = 'object';
            }
        }
        if (is_string($value) && is_numeric($value)) {
            $valueType = 'number';
        }

        return DataType::make($valueType);
    }
}
