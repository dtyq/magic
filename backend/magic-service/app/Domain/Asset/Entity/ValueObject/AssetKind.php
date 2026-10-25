<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Entity\ValueObject;

enum AssetKind: string
{
    case ASSET = 'ASSET';
    case GROUP = 'GROUP';

    public function isGroup(): bool
    {
        return $this === self::GROUP;
    }

    public function isAsset(): bool
    {
        return $this === self::ASSET;
    }
}
