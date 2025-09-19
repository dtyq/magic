<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Auth\Guard;

use App\Domain\Chat\DTO\Request\Common\MagicContext;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\WebSocketServer\Context as WebSocketContext;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

/**
 * 需要解析 websocket 上下文中的 token 信息，因此跟 WebUserGuard 不同.
 */
class WebsocketChatUserGuard extends WebUserGuard
{
    /**
     * @return MagicUserAuthorization
     * @throws Throwable
     */
    public function user(): Authenticatable
    {
        /** @var MagicContext $magicContext */
        $magicContext = WebSocketContext::get(MagicContext::class);
        $userAuthToken = $magicContext?->getAuthorization();
        if (empty($userAuthToken)) {
            ExceptionBuilder::throw(UserErrorCode::TOKEN_NOT_FOUND);
        }
        $organizationCode = $magicContext->getOrganizationCode();
        if (empty($organizationCode)) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
        }
        // 获取用户信息的缓存
        $contextKey = $this->resultKey($userAuthToken);
        if ($result = WebSocketContext::get($contextKey)) {
            if ($result instanceof Throwable) {
                throw $result;
            }
            if ($result instanceof MagicUserAuthorization) {
                return $result;
            }
            ExceptionBuilder::throw(UserErrorCode::TOKEN_NOT_FOUND);
        }
        // 下面这段实际调用的是 MagicUserAuthorization 的 retrieveById 方法
        /** @var MagicUserAuthorization $user */
        $user = $this->userProvider->retrieveByCredentials([
            'authorization' => $userAuthToken,
            'organizationCode' => $organizationCode,
            'superMagicAgentUserId' => $magicContext->getSuperMagicAgentUserId(),
        ]);
        if (empty($user->getOrganizationCode())) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
        }
        $user->setUserAuthToContext($contextKey);
        return $user;
    }
}
