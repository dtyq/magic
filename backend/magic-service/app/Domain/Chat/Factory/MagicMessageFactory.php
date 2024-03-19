<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Factory;

use App\Domain\Chat\Entity\MagicMessageEntity;

class MagicMessageFactory
{
    public static function arrayToEntity(array $message): MagicMessageEntity
    {
        return new MagicMessageEntity($message);
    }
}
