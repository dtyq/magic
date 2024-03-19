<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Expression;

use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;

class ValueDataTypeTransform
{
    public static function toNumber(mixed $value, ?DataType $sourceType = null): string
    {
        $valueType = DataType::makeByValue($value);
        if ($sourceType && $valueType !== $sourceType) {
            throw new FlowExprEngineException("Source Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }
        $sourceType = $valueType;

        switch ($sourceType) {
            case DataType::Number:
                break;
            case DataType::String:
                if (! is_numeric($value)) {
                    throw new FlowExprEngineException("Cannot convert {$value} to number");
                }
                $value = $value + 0;
                break;
            case DataType::Boolean:
                $value = $value ? 1 : 0;
                break;
            default:
                throw new FlowExprEngineException("Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }

        return (string) $value;
    }

    public static function toString(mixed $value, ?DataType $sourceType = null): string
    {
        $valueType = DataType::makeByValue($value);
        if ($sourceType && $valueType !== $sourceType) {
            throw new FlowExprEngineException("Source Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }
        $sourceType = $valueType;

        switch ($sourceType) {
            case DataType::String:
                break;
            case DataType::Number:
                $value = (string) $value;
                break;
            case DataType::Boolean:
                $value = $value ? 'true' : 'false';
                break;
            case DataType::Array:
            case DataType::Object:
                $value = json_encode($value, JSON_UNESCAPED_UNICODE);
                break;
            case DataType::Null:
                $value = 'null';
                break;
            default:
                throw new FlowExprEngineException("Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }

        return $value;
    }

    public static function toArray(mixed $value, ?DataType $sourceType = null): array
    {
        $valueType = DataType::makeByValue($value);
        if ($sourceType && $valueType !== $sourceType) {
            throw new FlowExprEngineException("Source Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }
        $sourceType = $valueType;

        switch ($sourceType) {
            case DataType::Array:
                break;
            case DataType::String:
            case DataType::Number:
            case DataType::Boolean:
            case DataType::Object:
            case DataType::Null:
                $value = [$value];
                break;
            default:
                throw new FlowExprEngineException("Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }

        return $value;
    }

    public static function toBoolean(mixed $value, ?DataType $sourceType = null): bool
    {
        $valueType = DataType::makeByValue($value);
        if ($sourceType && $valueType !== $sourceType) {
            throw new FlowExprEngineException("Source Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }
        $sourceType = $valueType;

        switch ($sourceType) {
            case DataType::Boolean:
                break;
            case DataType::Number:
                $value = (bool) $value;
                break;
            default:
                throw new FlowExprEngineException("Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }

        return $value;
    }

    public static function toJson(mixed $value, ?DataType $sourceType = null): string
    {
        $valueType = DataType::makeByValue($value);
        if ($sourceType && $valueType !== $sourceType) {
            throw new FlowExprEngineException("Source Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }
        $sourceType = $valueType;

        return match ($sourceType) {
            DataType::Array, DataType::Object => json_encode($value, JSON_UNESCAPED_UNICODE),
            default => throw new FlowExprEngineException("Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}"),
        };
    }

    public static function count(mixed $value, ?DataType $sourceType = null): int
    {
        $valueType = DataType::makeByValue($value);
        if ($sourceType && $valueType !== $sourceType) {
            throw new FlowExprEngineException("Source Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }
        $sourceType = $valueType;

        return match ($sourceType) {
            DataType::Array => count($value),
            default => throw new FlowExprEngineException("Source Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}"),
        };
    }

    public static function empty(mixed $value, ?DataType $sourceType = null): bool
    {
        $valueType = DataType::makeByValue($value);
        if ($sourceType && $valueType !== $sourceType) {
            throw new FlowExprEngineException("Source Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }
        $sourceType = $valueType;

        return match ($sourceType) {
            DataType::Array, DataType::Object => empty($value),
            default => throw new FlowExprEngineException("Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}"),
        };
    }

    public static function join(mixed $value, string $separator = "\n", ?DataType $sourceType = null): string
    {
        $valueType = DataType::makeByValue($value);
        if ($sourceType && $valueType !== $sourceType) {
            throw new FlowExprEngineException("Source Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }
        $sourceType = $valueType;

        switch ($valueType) {
            case DataType::Array:
                $data = [];
                foreach ($value as $item) {
                    if (is_array($item)) {
                        $item = json_encode($item, JSON_UNESCAPED_UNICODE);
                    }
                    $data[] = $item;
                }
                $value = implode($separator, $data);
                break;
            default:
                throw new FlowExprEngineException("Data type conversion error, expected type: {$sourceType->value}, actual type: {$valueType->value}");
        }
        return $value;
    }
}
