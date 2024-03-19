<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Middleware;

use App\ErrorCode\HttpErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class VerifyLoginMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        // 获取access_token
        $token = $request->getHeader('authorization')[0] ?? '';
        if (! $token) {
            ExceptionBuilder::throw(HttpErrorCode::Unauthorized);
        }
        // 校验token

        return $handler->handle($request);
    }
}
