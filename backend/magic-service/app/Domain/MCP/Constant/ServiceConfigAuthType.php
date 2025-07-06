<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Constant;

enum ServiceConfigAuthType: int
{
    case NONE = 0; // No authentication
    case OAUTH2 = 1; // OAuth2 authentication

    public function isOauth2(): bool
    {
        return $this === self::OAUTH2;
    }
}
