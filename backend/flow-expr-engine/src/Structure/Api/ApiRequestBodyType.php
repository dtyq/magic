<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Api;

use Dtyq\FlowExprEngine\Kernel\Utils\Functions;

enum ApiRequestBodyType: string
{
    case None = 'none';
    case FormData = 'form-data';
    case XWwwFormUrlencoded = 'x-www-form-urlencoded';
    case Json = 'json';

    public function getValue(): string
    {
        return $this->value;
    }

    public static function make(ApiRequestBodyType|string|null $type = null, bool $autoIdentify = false): ?ApiRequestBodyType
    {
        if ($type instanceof ApiRequestBodyType) {
            return $type;
        }
        if (is_null($type)) {
            return null;
        }
        if ($autoIdentify) {
            return self::autoIdentify($type);
        }
        return ApiRequestBodyType::tryFrom($type);
    }

    public static function autoIdentify(string $type): ApiRequestBodyType
    {
        if (Functions::strContains($type, 'multipart/form-data')) {
            return ApiRequestBodyType::FormData;
        }
        if (Functions::strContains($type, 'application/x-www-form-urlencoded')) {
            return ApiRequestBodyType::XWwwFormUrlencoded;
        }
        if (Functions::strContains($type, 'application/json')) {
            return ApiRequestBodyType::Json;
        }
        return ApiRequestBodyType::None;
    }
}
