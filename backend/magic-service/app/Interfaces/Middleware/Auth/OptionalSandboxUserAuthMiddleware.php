<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Middleware\Auth;

use App\Application\Authentication\Service\AuthSandboxAppService;
use App\Application\ModelGateway\Official\MagicAccessToken;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 可选的沙箱鉴权中间件。
 * - 优先尝试沙箱用户鉴权，成功则写入用户上下文与 API-Key；
 * - 失败/未登录直接放行，支持临时访问口令等场景。
 */
class OptionalSandboxUserAuthMiddleware extends BaseAuthMiddleware
{
    public function __construct(
        private readonly AuthSandboxAppService $sandboxAuthAppService
    ) {
    }

    protected function doProcess(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $magicUserAuthorization = $this->sandboxAuthAppService->tryAuthenticate($request->getHeaders());

        if ($magicUserAuthorization instanceof MagicUserAuthorization) {
            RequestCoContext::setUserAuthorization($magicUserAuthorization);

            // 保留旧行为：初始化并透传 API-Key 到协程上下文
            MagicAccessToken::init();
            if (defined('MAGIC_ACCESS_TOKEN')) {
                RequestCoContext::setApiKey(MAGIC_ACCESS_TOKEN);
            }

            $this->logger?->info('AuthFlow optionalSandboxUserAuth (logged in)', [
                'path' => $request->getUri()->getPath(),
                'method' => $request->getMethod(),
            ]);
        } else {
            $this->logger?->info('AuthFlow optionalSandboxUserAuth (anonymous)', [
                'path' => $request->getUri()->getPath(),
                'method' => $request->getMethod(),
            ]);
        }
        // 可选登录场景：失败时业务可自行判断是否使用其他鉴权方式。
        return $handler->handle($request);
    }
}
