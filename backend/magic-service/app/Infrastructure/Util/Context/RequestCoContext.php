<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Context;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Context\Context;

class RequestCoContext
{
    private const string API_KEY_CONTEXT_KEY = 'magic-api-key';

    /**
     * 从父协程获取用户信息。
     */
    public static function getUserAuthorization(): ?MagicUserAuthorization
    {
        return Context::get('magic-user-authorization');
    }

    public static function setUserAuthorization(MagicUserAuthorization $userAuthorization): void
    {
        Context::set('magic-user-authorization', $userAuthorization);
    }

    /**
     * 获取协程上下文中的 API-Key.
     */
    public static function getApiKey(): ?string
    {
        return Context::get(self::API_KEY_CONTEXT_KEY);
    }

    /**
     * 设置 API-Key 到协程上下文.
     */
    public static function setApiKey(string $apiKey): void
    {
        Context::set(self::API_KEY_CONTEXT_KEY, $apiKey);
    }

    /**
     * 检查协程上下文中是否存在 API-Key.
     */
    public static function hasApiKey(): bool
    {
        return Context::has(self::API_KEY_CONTEXT_KEY) && ! empty(Context::get(self::API_KEY_CONTEXT_KEY));
    }
}
