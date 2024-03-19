<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Middleware;

use App\Interfaces\Middleware\Auth\UserAuthMiddleware;

/**
 * 鉴权中间件统一到 Auth 目录下，这里保留一个空壳，用于向后兼容。
 */
class RequestContextMiddleware extends UserAuthMiddleware
{
}
