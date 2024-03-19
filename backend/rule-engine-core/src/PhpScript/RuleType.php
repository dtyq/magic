<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript;

use Dtyq\RuleEngineCore\Standards\Exception\ConfigurationException;

class RuleType
{
    public const Script = 0;

    public const Expression = 1;

    public string $name;

    public int $value;

    public static function from(int $value): static
    {
        $ruleType = new static();
        switch ($value) {
            case static::Script:
                $ruleType->name = 'Script';
                $ruleType->value = static::Script;
                break;
            case static::Expression:
                $ruleType->name = 'Expression';
                $ruleType->value = static::Expression;
                break;
            default:
                throw new ConfigurationException('Invalid enumeration value:' . static::class);
        }

        return $ruleType;
    }

    public static function isExpression($ruleType): bool
    {
        if ($ruleType == static::Expression) {
            return true;
        }

        return false;
    }
}
