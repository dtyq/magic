<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Model;

class Rerank
{
    public function __construct(public array $result)
    {
    }

    public function getResults(): array
    {
        return $this->result;
    }
}
