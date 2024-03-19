<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject\Query;

abstract class Query
{
    /**
     * @var array ['updated_at' => 'desc']
     */
    protected array $order = [];

    public function getOrder(): array
    {
        return $this->order;
    }

    public function setOrder(array $order): void
    {
        $this->order = $order;
    }
}
