<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Expression\ExpressionDataSource;

enum ExpressionDataSourceSystemFields: string
{
    case GuzzleResponseHttpCode = 'guzzle.response.http_code';
    case GuzzleResponseHeader = 'guzzle.response.header';
    case GuzzleResponseBody = 'guzzle.response.body';
    case LoopValue = 'loop_value';

    public function getName(): string
    {
        return match ($this) {
            self::GuzzleResponseHttpCode => 'http状态码',
            self::GuzzleResponseHeader => '响应头',
            self::GuzzleResponseBody => '响应体',
            self::LoopValue => '循环值',
        };
    }

    public static function responseList(): array
    {
        return [
            self::GuzzleResponseHttpCode->value => self::GuzzleResponseHttpCode->getName(),
            self::GuzzleResponseHeader->value => self::GuzzleResponseHeader->getName(),
            self::GuzzleResponseBody->value => self::GuzzleResponseBody->getName(),
        ];
    }

    public static function loopList(): array
    {
        return [
            self::LoopValue->value => self::LoopValue->getName(),
        ];
    }

    public static function getResponseSource(string $label, string $componentId, ?string $desc = null, ?string $relationId = null): ExpressionDataSourceFields
    {
        $expressionDataSourceFields = new ExpressionDataSourceFields($label, uniqid('fields_'), $desc, $relationId);
        foreach (self::responseList() as $key => $title) {
            $value = "{$componentId}.{$key}";
            $expressionDataSourceFields->addChildren($title, $value);
        }
        return $expressionDataSourceFields;
    }

    public static function getLoopSource(string $label, string $componentId, ?string $desc = null, ?string $relationId = null): ExpressionDataSourceFields
    {
        $expressionDataSourceFields = new ExpressionDataSourceFields($label, uniqid('fields_'), $desc, $relationId);
        foreach (self::loopList() as $key => $title) {
            $value = "{$componentId}.{$key}";
            $expressionDataSourceFields->addChildren($title, $value);
        }
        return $expressionDataSourceFields;
    }
}
