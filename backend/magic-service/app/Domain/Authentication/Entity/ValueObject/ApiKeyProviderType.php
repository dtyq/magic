<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Authentication\Entity\ValueObject;

enum ApiKeyProviderType: int
{
    case None = 0;
    case Flow = 1;
    case MCP = 2;
}
