<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\Service;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

/**
 * 提供标准用户鉴权能力（web guard）。
 */
class AuthUserAppService extends AuthBaseAppService
{
    /**
     * @return MagicUserAuthorization
     *
     * @throws Throwable
     */
    public function authenticate(): Authenticatable
    {
        return $this->authenticateByWebGuard();
    }

    /**
     * 可选登录场景：catch 所有异常，失败返回 null。
     */
    public function tryAuthenticate(): ?MagicUserAuthorization
    {
        try {
            $authorization = $this->authenticate();
            return $authorization instanceof MagicUserAuthorization ? $authorization : null;
        } catch (Throwable) {
            // 可选登录场景：catch 所有异常，失败返回 null。
            // 由业务侧自主决定没有登录态的行为
            return null;
        }
    }
}
