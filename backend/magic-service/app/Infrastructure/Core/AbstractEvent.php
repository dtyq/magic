<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core;

use Hyperf\Contract\Arrayable;
use JsonSerializable;

class AbstractEvent implements JsonSerializable, Arrayable
{
    public function jsonSerialize(): array
    {
        return get_object_vars($this);
    }

    public function toArray(): array
    {
        return get_object_vars($this);
    }
}
