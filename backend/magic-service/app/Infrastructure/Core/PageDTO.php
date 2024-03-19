<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core;

class PageDTO extends AbstractDTO
{
    public int $page = 1;

    public int $total = 0;

    public array $list = [];

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPage(int $page): self
    {
        $this->page = $page;
        return $this;
    }

    public function getTotal(): int
    {
        return $this->total;
    }

    public function setTotal(int $total): self
    {
        $this->total = $total;
        return $this;
    }

    public function getList(): array
    {
        return $this->list;
    }

    public function setList(array $list): self
    {
        $this->list = $list;
        return $this;
    }
}
