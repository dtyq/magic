<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Middleware\Auth;

use App\Application\Authentication\Service\AuthUserAppService;
use App\Infrastructure\Util\Context\RequestCoContext;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 可选鉴权中间件。
 * - 登录成功则写入用户上下文；
 * - 失败/未登录直接放行，业务可通过上下文判定登录态。
 */
class OptionalUserAuthMiddleware extends BaseAuthMiddleware
{
    public function __construct(
        private readonly AuthUserAppService $userAuthAppService
    ) {
    }

    protected function doProcess(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $magicUserAuthorization = $this->userAuthAppService->tryAuthenticate();
        if ($magicUserAuthorization !== null) {
            RequestCoContext::setUserAuthorization($magicUserAuthorization);
            $this->logger?->info('authCheckSuccess optionalUserAuth (logged in)');
        } else {
            $this->logger?->info('authCheckSuccess optionalUserAuth (anonymous)');
        }

        return $handler->handle($request);
    }
}
