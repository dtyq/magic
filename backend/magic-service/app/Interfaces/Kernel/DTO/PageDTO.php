<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\DTO;

use App\Infrastructure\Core\AbstractDTO;

class PageDTO extends AbstractDTO
{
    public function __construct(public int $page, public int $total, public array $list)
    {
        $this->list = array_values($this->list);
        parent::__construct();
    }

    /**
     * 获取页码
     */
    public function getPage(): int
    {
        return $this->page;
    }

    /**
     * 获取总数.
     */
    public function getTotal(): int
    {
        return $this->total;
    }

    /**
     * 获取列表数据.
     */
    public function getList(): array
    {
        return $this->list;
    }

    /**
     * 设置页码
     */
    public function setPage(int $page): self
    {
        $this->page = $page;
        return $this;
    }

    /**
     * 设置总数.
     */
    public function setTotal(int $total): self
    {
        $this->total = $total;
        return $this;
    }

    /**
     * 设置列表数据.
     */
    public function setList(array $list): self
    {
        $this->list = array_values($list);
        return $this;
    }
}
