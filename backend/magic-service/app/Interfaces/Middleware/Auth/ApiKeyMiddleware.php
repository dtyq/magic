<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Middleware\Auth;

use App\Application\Authentication\DTO\ApiKeyAuthResult;
use App\Application\Authentication\Service\AuthApiKeyAppService;
use App\Application\ModelGateway\Official\MagicAccessToken;
use App\ErrorCode\HttpErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 模型网关 API-Key 鉴权中间件。
 * - 优先沙箱用户鉴权，失败则校验 api-key；
 * - 支持 user-authorization / api-key / x-api-key / 兼容授权头；
 * - 成功时写入用户/ApiKey 上下文，失败抛 Unauthorized。
 */
class ApiKeyMiddleware extends BaseAuthMiddleware
{
    public function __construct(
        private readonly AuthApiKeyAppService $apiKeyAuthAppService
    ) {
    }

    protected function doProcess(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $result = $this->apiKeyAuthAppService->authenticate($request->getHeaders(), $request->getServerParams());

        if ($result->userAuthorization !== null && $result->accessTokenEntity === null) {
            $this->fillSandboxContext($result);
            return $handler->handle($request);
        }

        if ($result->accessTokenEntity !== null) {
            $this->fillApiKeyContext($result);
            return $handler->handle($request);
        }

        $this->logger?->warning('AuthFlow auth failed', [
            'path' => $request->getUri()->getPath(),
            'method' => $request->getMethod(),
        ]);
        ExceptionBuilder::throw(HttpErrorCode::Unauthorized, throwable: $result->sandboxException);
    }

    private function fillSandboxContext(ApiKeyAuthResult $result): void
    {
        RequestCoContext::setUserAuthorization($result->userAuthorization);

        MagicAccessToken::init();
        if (defined('MAGIC_ACCESS_TOKEN')) {
            RequestCoContext::setApiKey(MAGIC_ACCESS_TOKEN);
        }

        $this->logger?->debug('AuthFlow user-authorization success', [
            'source' => 'sandbox_user_auth',
        ]);
    }

    private function fillApiKeyContext(ApiKeyAuthResult $result): void
    {
        RequestCoContext::setApiKey($result->apiKey ?? '');

        if ($result->userAuthorization !== null) {
            RequestCoContext::setUserAuthorization($result->userAuthorization);
        }

        $this->logger?->debug('AuthFlow api-key success', [
            'type' => $result->accessTokenEntity->getType()->value,
            'relation_id' => $result->accessTokenEntity->getRelationId(),
        ]);
    }
}
