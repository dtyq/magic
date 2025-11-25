<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Middleware;

use App\Infrastructure\Util\Context\CoContext;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class RequestIdMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        // 如果外部有request-id，则直接使用
        $apikey = $request->getHeaderLine('api-key');

        // 处理header的Magic-User-Id 存在["usi_8","xxxxxxxxx"]问题，合并为"usi_8xxxxxxxxx"
        $magicUserId = $request->getHeader('magic-user-id');
        if ($magicUserId && count(value: $magicUserId) > 1) {
            $magicUserId = implode('', $magicUserId);
            $request = $request->withHeader('magic-user-id', $magicUserId);
        }
        return $handler->handle($request);
    }
}
