<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ListDTO extends AbstractDTO
{
    public function __construct(public array $list)
    {
        $this->list = array_values($this->list);
        parent::__construct();
    }

    /**
     * 获取列表数据.
     */
    public function getList(): array
    {
        return $this->list;
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
