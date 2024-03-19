<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core;

abstract class AbstractQuery extends AbstractObject
{
    /**
     * @var array ['updated_at' => 'desc']
     */
    protected array $order = [];

    protected array $select = [];

    private ?string $keyBy = null;

    public function getOrder(): array
    {
        return $this->order;
    }

    public function setOrder(array $order): void
    {
        $this->order = $order;
    }

    public function getSelect(): array
    {
        return $this->select;
    }

    public function setSelect(array $select): void
    {
        $this->select = $select;
    }

    public function getKeyBy(): ?string
    {
        return $this->keyBy;
    }

    public function setKeyBy(?string $keyBy): void
    {
        $this->keyBy = $keyBy;
    }
}
