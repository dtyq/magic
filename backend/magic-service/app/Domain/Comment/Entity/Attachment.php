<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Comment\Entity;

class Attachment
{
    public function __construct(private string $uid, private string $key, private string $name, private int $originType)
    {
    }

    public function getUid(): string
    {
        return $this->uid;
    }

    public function getKey(): string
    {
        return $this->key;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getOriginType(): int
    {
        return $this->originType;
    }
}
