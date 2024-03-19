<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Traits;

use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Qbhy\HyperfAuth\Authenticatable;
use Qbhy\HyperfAuth\AuthManager;

trait MagicUserAuthorizationTrait
{
    /**
     * @return MagicUserAuthorization
     */
    protected function getAuthorization(): Authenticatable
    {
        $magicUserAuthorization = RequestCoContext::getUserAuthorization();
        if (! $magicUserAuthorization) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
        }
        return $magicUserAuthorization;
    }

    /**
     * 有些接口把常规的 authorization 访问和临时的访问密码访问合并在一起了，无法使用中间件来鉴权，是在接口中单独调用的此访问验证 authorization.
     * @return MagicUserAuthorization
     */
    protected function checkAndGetAuthorization(): Authenticatable
    {
        $magicUserAuthorization = di(AuthManager::class)->guard(name: 'web')->user();
        if (! $magicUserAuthorization) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
        }
        return $magicUserAuthorization;
    }
}
