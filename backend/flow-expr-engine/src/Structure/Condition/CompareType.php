<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Condition;

enum CompareType: string
{
    /**
     * 等于.
     */
    case Equals = 'equals';

    /**
     * 不等于.
     */
    case NoEquals = 'no_equals';

    /**
     * 包含.
     */
    case Contains = 'contains';

    /**
     * 不包含.
     */
    case NoContains = 'no_contains';

    /**
     * 大于.
     */
    case Gt = 'gt';

    /**
     * 小于.
     */
    case Lt = 'lt';

    /**
     * 大于等于.
     */
    case Gte = 'gte';

    /**
     * 小于等于.
     */
    case Lte = 'lte';

    /**
     * 没值
     */
    case Empty = 'empty';

    /**
     * 有值
     */
    case NotEmpty = 'not_empty';

    /**
     * 为空.
     */
    case Valuable = 'valuable';

    /**
     * 不为空.
     */
    case NoValuable = 'no_valuable';

    public static function make(?string $input): ?CompareType
    {
        $compareType = CompareType::tryFrom($input ?? '');
        if (! is_null($compareType)) {
            return $compareType;
        }
        // 特殊的类型
        return match ($input) {
            '>' => CompareType::Gt,
            '<' => CompareType::Lt,
            '>=' => CompareType::Gte,
            '<=' => CompareType::Lte,
            '!=' => CompareType::NoEquals,
            '=' ,'==', '===' => CompareType::Equals,
            default => null,
        };
    }

    public function isRightOperandsRequired(): bool
    {
        return in_array($this, [
            CompareType::Equals,
            CompareType::NoEquals,
            CompareType::Contains,
            CompareType::NoContains,
            CompareType::Gt,
            CompareType::Lt,
            CompareType::Gte,
            CompareType::Lte,
        ]);
    }
}
