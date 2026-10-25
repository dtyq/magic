<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Entity\ValueObject;

enum SlidesTemplateOwnerType: string
{
    case Official = 'OFFICIAL';
    case Organization = 'ORGANIZATION';
    case User = 'USER';

    public function isOfficial(): bool
    {
        return $this === self::Official;
    }

    public function isUser(): bool
    {
        return $this === self::User;
    }
}
