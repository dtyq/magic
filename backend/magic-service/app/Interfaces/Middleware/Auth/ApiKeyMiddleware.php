<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Middleware\Auth;

use App\Application\Authentication\DTO\ApiKeyAuthResult;
use App\Application\Authentication\Service\AuthApiKeyAppService;
use App\Application\ModelGateway\Official\MagicAccessToken;
use App\Application\ModelGateway\Request\ModelGatewayRequestCoContext;
use App\ErrorCode\HttpErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 模型网关 API-Key 鉴权中间件。
 * - 优先 user-authorization（ModelGatewayUser / User 过渡兼容）鉴权，失败时回退 api-key；
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
        // 鉴权细节由 AppService 统一处理，中间件只负责“结果分发”和上下文注入。
        $result = $this->apiKeyAuthAppService->authenticate($request->getHeaders(), $request->getServerParams());

        if ($result->userAuthorization !== null && $result->accessTokenEntity === null) {
            $this->fillUserAuthorizationContext($result);
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
        ExceptionBuilder::throw(HttpErrorCode::Unauthorized, throwable: $result->authException);
    }

    private function fillUserAuthorizationContext(ApiKeyAuthResult $result): void
    {
        // 用户令牌链路：请求里可能没有历史 api-key，这里注入全局 MAGIC_ACCESS_TOKEN 以兼容下游读取。
        RequestCoContext::setUserAuthorization($result->userAuthorization);

        MagicAccessToken::init();
        if (defined('MAGIC_ACCESS_TOKEN')) {
            RequestCoContext::setApiKey(MAGIC_ACCESS_TOKEN);
        }

        $this->logger?->debug('AuthFlow user-authorization success', [
            'source' => $result->authSource !== '' ? $result->authSource : 'model_gateway_user_auth',
            'token_type' => $result->authTokenType,
        ]);
    }

    private function fillApiKeyContext(ApiKeyAuthResult $result): void
    {
        // AccessToken 链路：优先保留来路 api-key；若是 user 类型再补 userAuthorization。
        RequestCoContext::setApiKey($result->apiKey ?? '');
        if ($result->accessTokenEntity) {
            ModelGatewayRequestCoContext::setAccessToken($result->accessTokenEntity);
        }

        if ($result->userAuthorization !== null) {
            RequestCoContext::setUserAuthorization($result->userAuthorization);
        }

        $this->logger?->debug('AuthFlow api-key success', [
            'source' => $result->authSource,
            'token_type' => $result->authTokenType,
            'type' => $result->accessTokenEntity->getType()->value,
            'relation_id' => $result->accessTokenEntity->getRelationId(),
        ]);
    }
}
