<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Request;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use Hyperf\Context\Context;

class ModelGatewayRequestCoContext
{
    public const string ACCESS_TOKEN_CONTEXT_KEY = 'model-gateway-access-token';

    public static function setAccessToken(AccessTokenEntity $accessTokenEntity): void
    {
        Context::set(self::ACCESS_TOKEN_CONTEXT_KEY, $accessTokenEntity);
    }

    public static function hasAccessToken(): bool
    {
        return Context::has(self::ACCESS_TOKEN_CONTEXT_KEY);
    }

    public static function getAccessToken(): ?AccessTokenEntity
    {
        return Context::get(self::ACCESS_TOKEN_CONTEXT_KEY);
    }
}
