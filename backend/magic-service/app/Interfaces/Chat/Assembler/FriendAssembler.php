<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Assembler;

use App\Domain\Chat\Entity\MagicFriendEntity;

class FriendAssembler
{
    public static function getFriendEntity(array $friend): MagicFriendEntity
    {
        return new MagicFriendEntity($friend);
    }
}
