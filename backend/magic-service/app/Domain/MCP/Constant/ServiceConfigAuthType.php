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
    case MCP_AUTHORIZATION = 2; // MCP 2026-07-28 Authorization

    public function isOauth2(): bool
    {
        return $this === self::OAUTH2;
    }

    /**
     * 判断是否为 MCP 标准授权模式。
     */
    public function isMcpAuthorization(): bool
    {
        return $this === self::MCP_AUTHORIZATION;
    }
}
