<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;

class SystemAccessTokenManager
{
    /**
     * @var array<string, AccessTokenEntity>
     */
    public static array $maps = [];

    public static function getByEncryptedAccessToken(string $encryptedAccessToken): ?AccessTokenEntity
    {
        return self::$maps[$encryptedAccessToken] ?? null;
    }

    public static function setSystemAccessToken(AccessTokenEntity $accessTokenEntity): void
    {
        self::$maps[$accessTokenEntity->getEncryptedAccessToken()] = $accessTokenEntity;
    }
}
