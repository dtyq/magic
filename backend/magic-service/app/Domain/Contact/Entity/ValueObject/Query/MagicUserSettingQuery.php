<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject\Query;

use App\Infrastructure\Core\AbstractQuery;

class MagicUserSettingQuery extends AbstractQuery
{
    private ?string $userId = null;

    private ?string $key = null;

    private ?array $keys = null;

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function setUserId(?string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getKey(): ?string
    {
        return $this->key;
    }

    public function setKey(?string $key): self
    {
        $this->key = $key;
        return $this;
    }

    public function getKeys(): ?array
    {
        return $this->keys;
    }

    public function setKeys(?array $keys): self
    {
        $this->keys = $keys;
        return $this;
    }
}
