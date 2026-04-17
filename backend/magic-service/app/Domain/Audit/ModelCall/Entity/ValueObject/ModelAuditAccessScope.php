<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Entity\ValueObject;

use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;

/**
 * 模型调用审计访问范围：开放平台(API) 与 Magic 内应用.
 */
enum ModelAuditAccessScope: string
{
    case ApiPlatform = 'api_platform';
    case Magic = 'magic';

    public static function fromAccessTokenType(AccessTokenType $type): self
    {
        return match ($type) {
            AccessTokenType::User => self::ApiPlatform,
            AccessTokenType::Application => self::Magic,
            default => self::Magic,
        };
    }
}
