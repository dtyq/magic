<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Context;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\Context;
use Hyperf\HttpServer\Contract\RequestInterface;
use Psr\Http\Message\ServerRequestInterface;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * 请求上下文类.
 *
 * 使用 Hyperf Context 存储数据，确保在协程环境下的数据安全。
 * 每个协程都有独立的上下文数据，避免多个请求共享数据导致的混乱问题。
 */
class RequestContext
{
    // 协程上下文的键名常量
    private const string CONTEXT_KEY_USER_ID = 'request-context.user-id';

    private const string CONTEXT_KEY_ORGANIZATION_CODE = 'request-context.organization-code';

    private const string CONTEXT_KEY_AUTHORIZATION = 'request-context.authorization';

    private const string CONTEXT_KEY_USER_AUTHORIZATION = 'request-context.user-authorization';

    private const string CONTEXT_KEY_DATA_ISOLATION = 'request-context.data-isolation';

    private const string CONTEXT_KEY_THIRD_PLATFORM_ACCESS_TOKEN = 'request-context.third-platform-access-token';

    public static function getRequestContext(RequestInterface|ServerRequestInterface $request): self
    {
        return $request->getAttribute('request_context');
    }

    public function getUserId(): string
    {
        return Context::get(self::CONTEXT_KEY_USER_ID, '');
    }

    public function setUserId(string $userId): void
    {
        Context::set(self::CONTEXT_KEY_USER_ID, $userId);
    }

    public function getOrganizationCode(): string
    {
        return Context::get(self::CONTEXT_KEY_ORGANIZATION_CODE, '');
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        Context::set(self::CONTEXT_KEY_ORGANIZATION_CODE, $organizationCode);
    }

    public function getAuthorization(): string
    {
        return Context::get(self::CONTEXT_KEY_AUTHORIZATION, '');
    }

    public function setAuthorization(string $authorization): void
    {
        Context::set(self::CONTEXT_KEY_AUTHORIZATION, $authorization);
    }

    public function getUserAuthorization(): MagicUserAuthorization
    {
        /* @phpstan-ignore-next-line */
        return Context::get(self::CONTEXT_KEY_USER_AUTHORIZATION);
    }

    public function setUserAuthorization(Authenticatable|MagicUserAuthorization $userAuthorization): void
    {
        Context::set(self::CONTEXT_KEY_USER_AUTHORIZATION, $userAuthorization);
    }

    public function getDataIsolation(): ?DataIsolation
    {
        return Context::get(self::CONTEXT_KEY_DATA_ISOLATION);
    }

    public function setDataIsolation(?DataIsolation $dataIsolation): RequestContext
    {
        Context::set(self::CONTEXT_KEY_DATA_ISOLATION, $dataIsolation);
        return $this;
    }

    public function getThirdPlatformAccessToken(): string
    {
        return Context::get(self::CONTEXT_KEY_THIRD_PLATFORM_ACCESS_TOKEN, '');
    }

    public function setThirdPlatformAccessToken(string $thirdPlatformAccessToken): RequestContext
    {
        Context::set(self::CONTEXT_KEY_THIRD_PLATFORM_ACCESS_TOKEN, $thirdPlatformAccessToken);
        return $this;
    }
}
