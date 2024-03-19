<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\Standards\Admin;

use Dtyq\RuleEngineCore\Standards\Exception\ConfigurationException;

/**
 * @TODO:未完成所有枚举定义
 * String为额外定义的类型
 */
class InputType
{
    public const String = 1;

    public const Stream = 2;

    public string $name;

    public int $value;

    //    public function __construct(int $value)
    //    {
    //        switch ($value) {
    //            case static::String:
    //                $this->name = 'String';
    //                $this->value = static::String;
    //                break;
    //            case static::Stream:
    //                $this->name = 'Stream';
    //                $this->value = static::Stream;
    //                break;
    //            default:
    //                throw new ConfigurationException('Invalid enumeration value:' . static::class);
    //        }
    //    }

    /**
     * @return InputType[]
     */
    public static function cases(): array
    {
        return [
            static::from(static::String),
            static::from(static::Stream),
        ];
    }

    public static function from(int $value): static
    {
        $inputType = new static();
        switch ($value) {
            case static::String:
                $inputType->name = 'String';
                $inputType->value = static::String;
                break;
            case static::Stream:
                $inputType->name = 'Stream';
                $inputType->value = static::Stream;
                break;
            default:
                throw new ConfigurationException('Invalid enumeration value:' . static::class);
        }

        return $inputType;
    }
}
