<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\Admin;

use Dtyq\RuleEngineCore\Standards\Exception\ConfigurationException;

class ExecutableType
{
    public const CLASS_TYPE = 1;

    public const FUNCTION_TYPE = 2;

    public const CONSTANT_TYPE = 3;

    public string $name;

    public int $value;

    public static function from(int $value): static
    {
        $enum = new static();
        switch ($value) {
            case static::CLASS_TYPE:
                $enum->name = 'CLASS';
                $enum->value = static::CLASS_TYPE;
                break;
            case static::FUNCTION_TYPE:
                $enum->name = 'FUNCTION';
                $enum->value = static::FUNCTION_TYPE;
                break;
            case static::CONSTANT_TYPE:
                $enum->name = 'CONSTANT';
                $enum->value = static::CONSTANT_TYPE;
                break;
            default:
                throw new ConfigurationException('Invalid enumeration value:' . static::class);
        }

        return $enum;
    }
}
