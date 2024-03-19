<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\Service;

use App\Domain\Contact\Service\MagicUserDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Contract\ConfigInterface;
use Throwable;

class AuthSandboxAppService extends AuthBaseAppService
{
    public function __construct(
        private readonly ConfigInterface $config,
        private readonly MagicUserDomainService $magicUserDomainService
    ) {
    }

    /**
     * 优先标准用户鉴权，失败时尝试兼容模式。
     *
     * @param array<string,mixed> $headers
     *
     * @throws Throwable 当所有鉴权方式失败时抛出原始异常
     */
    public function authenticate(array $headers): ?MagicUserAuthorization
    {
        try {
            return $this->authenticateByWebGuard();
        } catch (Throwable $e) {
            return $this->trySandboxCompatibleAuth($headers, $this->config, $this->magicUserDomainService, $e);
        }
    }

    /**
     * 可选登录场景：失败时返回 null，业务可自行判断。
     *
     * @param array<string,mixed> $headers
     */
    public function tryAuthenticate(array $headers): ?MagicUserAuthorization
    {
        try {
            $authorization = $this->authenticate($headers);
            return $authorization instanceof MagicUserAuthorization ? $authorization : null;
        } catch (Throwable) {
            // 可选登录场景：失败时返回 null，业务可自行判断。
            return null;
        }
    }
}
