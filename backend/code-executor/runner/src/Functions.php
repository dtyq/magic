<?php

declare(strict_types=1);

/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeRunnerBwrap;

use Hyperf\Codec\Json;

function response(StatusCode $code, array $data = [], string $message = ''): string
{
    return Json::encode(compact('code', 'message', 'data'));
}

function success(array $data, string $message = 'ok'): string
{
    return response(StatusCode::OK, $data, $message);
}

function error(StatusCode $code, string $message): string
{
    return response($code, message: $message);
}

function env(string $key, mixed $default = null): mixed
{
    if (($value = getenv($key)) === false) {
        return $default;
    }
    return $value;
}
