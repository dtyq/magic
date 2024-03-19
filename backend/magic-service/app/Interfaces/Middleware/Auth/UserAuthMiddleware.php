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
use Throwable;

/**
 * 标准用户鉴权（web guard）中间件。
 * - 要求登录，失败抛出业务异常；
 * - 鉴权成功写入协程上下文，供接口层读取。
 */
class UserAuthMiddleware extends BaseAuthMiddleware
{
    public function __construct(
        private readonly AuthUserAppService $userAuthAppService
    ) {
    }

    /**
     * @throws Throwable
     */
    protected function doProcess(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $magicUserAuthorization = $this->userAuthAppService->authenticate();

        RequestCoContext::setUserAuthorization($magicUserAuthorization);
        $this->logger?->debug('AuthFlow user-auth success', [
            'path' => $request->getUri()->getPath(),
            'method' => $request->getMethod(),
            'user_id' => $magicUserAuthorization->getId(),
            'organization_code' => $magicUserAuthorization->getOrganizationCode(),
        ]);

        return $handler->handle($request);
    }
}
