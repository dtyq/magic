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
use Throwable;

/**
 * 沙箱用户鉴权中间件。
 * - 优先标准 web 鉴权，失败走沙箱兼容层；
 * - 沙箱有模型网关访问权：鉴权成功后设置 MAGIC_ACCESS_TOKEN 到 api-key 上下文；
 * - 业务不希望有两个渠道下发模型网关访问权，但沙箱必须可访问：因此沙箱 user-auth 设计为短效可 refresh 的动态 token（区别于稳定的 api-key）。
 */
class SandboxUserAuthMiddleware extends BaseAuthMiddleware
{
    public function __construct(
        private readonly AuthSandboxAppService $sandboxAuthAppService
    ) {
    }

    /**
     * @throws Throwable
     */
    protected function doProcess(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $magicUserAuthorization = $this->sandboxAuthAppService->authenticate($request->getHeaders());

        if ($magicUserAuthorization instanceof MagicUserAuthorization) {
            RequestCoContext::setUserAuthorization($magicUserAuthorization);

            // 初始化并设置 API-Key 到协程上下文（保留旧行为）
            MagicAccessToken::init();
            if (defined('MAGIC_ACCESS_TOKEN')) {
                RequestCoContext::setApiKey(MAGIC_ACCESS_TOKEN);
            }

            $this->logger?->debug('AuthFlow user-authorization success', [
                'path' => $request->getUri()->getPath(),
                'method' => $request->getMethod(),
                'source' => 'sandbox_user_auth',
            ]);
        } else {
            $this->logger?->warning('AuthFlow sandboxUserAuth token only (no user context)', [
                'path' => $request->getUri()->getPath(),
                'method' => $request->getMethod(),
            ]);
        }

        return $handler->handle($request);
    }
}
