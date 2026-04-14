<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

enum VideoGenerationType: int
{
    case None = 0;
    case TEXT_TO_VIDEO = 1;
    case IMAGE_TO_VIDEO = 2;

    public static function make(null|int|string $type): self
    {
        if (is_string($type)) {
            $type = (int) $type;
        }
        if ($type === null) {
            return self::None;
        }

        return self::tryFrom($type) ?? self::None;
    }
}
