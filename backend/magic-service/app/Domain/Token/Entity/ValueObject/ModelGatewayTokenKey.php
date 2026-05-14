<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Entity\ValueObject;

final class ModelGatewayTokenKey
{
    public const string API_KEY_PREFIX = 'mgw_';

    public static function normalize(string $token): string
    {
        $token = trim($token);
        if ($token === '') {
            return '';
        }

        if (stripos($token, 'Bearer ') === 0) {
            return trim(substr($token, 7));
        }

        return $token;
    }

    public static function isModelGatewayApiKey(string $token): bool
    {
        $token = self::normalize($token);
        return $token !== '' && str_starts_with($token, self::API_KEY_PREFIX);
    }

    public static function hashForStorage(string $token): string
    {
        return hash('sha256', self::normalize($token));
    }
}
