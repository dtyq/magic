<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Factory;

use App\Domain\File\Entity\DefaultFileEntity;

class DefaultFileEntityFactory
{
    public static function toEntity(array $defaultFile): DefaultFileEntity
    {
        return new DefaultFileEntity($defaultFile);
    }

    public static function toEntities(array $defaultFiles): array
    {
        if (empty($defaultFiles)) {
            return [];
        }
        $defaultFileEntities = [];
        foreach ($defaultFiles as $defaultFile) {
            $defaultFileEntities[] = self::toEntity((array) $defaultFile);
        }
        return $defaultFileEntities;
    }
}
