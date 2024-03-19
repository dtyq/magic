<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity;

use Hyperf\Codec\Json;

abstract class AbstractEntity extends \App\Infrastructure\Core\AbstractEntity
{
    protected function transformJson(null|array|string $jsonData): array
    {
        if (empty($jsonData)) {
            return [];
        }
        if (is_array($jsonData)) {
            return $jsonData;
        }
        return Json::decode($jsonData);
    }
}
