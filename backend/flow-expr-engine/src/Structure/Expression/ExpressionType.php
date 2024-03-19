<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Expression;

enum ExpressionType: string
{
    case Field = 'fields';
    case Input = 'input';
    case Method = 'methods';

    // 为 const 提供的特殊类型，不参与运算，仅保存
    case Member = 'member';
    case Datetime = 'datetime';
    case Multiple = 'multiple';
    case Select = 'select';
    case Checkbox = 'checkbox';
    case DepartmentNames = 'department_names';
    case Names = 'names';

    public static function make(?string $input): ?ExpressionType
    {
        if (is_null($input)) {
            return null;
        }
        // 先尝试直接转换
        $type = self::tryFrom($input);
        if ($type) {
            return $type;
        }
        // 可能会有干扰数据，比如 fields_123
        $type = explode('_', $input)[0];
        return ExpressionType::tryFrom($type);
    }

    public function isDisplayValue(): bool
    {
        return in_array($this, [
            self::Member,
            self::Datetime,
            self::Multiple,
            self::Select,
            self::Checkbox,
            self::DepartmentNames,
            self::Names,
        ]);
    }
}
