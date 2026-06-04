<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\Service;

use App\Domain\Chat\DTO\Request\Common\MagicContext;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\RequestContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\WebSocketServer\Context as WebSocketContext;
use Throwable;

class AuthSandboxAppService extends AuthBaseAppService
{
    public function __construct(
        private readonly ConfigInterface $config,
        private readonly MagicUserDomainService $magicUserDomainService
    ) {
    }

    /**
     * HTTP/WebSocket 场景保持旧链路；只有 IPC 场景才使用显式传入的 headers。
     *
     * @param array<string,mixed> $headers
     *
     * @throws Throwable 当所有鉴权方式失败时抛出原始异常
     */
    public function authenticate(array $headers): ?MagicUserAuthorization
    {
        if (! $this->hasRequestContext()) {
            return $this->authenticateByIpcHeaders($headers);
        }

        try {
            return $this->authenticateByWebGuard();
        } catch (Throwable $origin) {
            return $this->trySandboxCompatibleAuth($headers, $this->config, $this->magicUserDomainService, $origin);
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

    /**
     * WebGuard 依赖 HTTP/WebSocket 上下文；IPC 调用没有上下文时跳过异常驱动的失败路径。
     */
    protected function hasRequestContext(): bool
    {
        return RequestContext::has() || WebSocketContext::get(MagicContext::class) instanceof MagicContext;
    }

    /**
     * @param array<string,mixed> $headers
     *
     * @throws Throwable
     */
    private function authenticateByIpcHeaders(array $headers): ?MagicUserAuthorization
    {
        try {
            return $this->authenticateByHeaders($headers);
        } catch (Throwable $origin) {
            return $this->trySandboxCompatibleAuth(
                $headers,
                $this->config,
                $this->magicUserDomainService,
                $origin
            );
        }
    }
}
