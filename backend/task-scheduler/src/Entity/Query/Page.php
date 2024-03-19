<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Entity\Query;

class Page
{
    private int $page;

    private int $pageNum;

    private bool $enable = true;

    public function __construct($page = 1, $pageNum = 20)
    {
        $page = intval($page);
        $page = $page <= 0 ? 1 : $page;
        $pageNum = intval($pageNum);
        $pageNum = ($pageNum <= 0 || $pageNum > 200) ? 10 : $pageNum;
        $this->page = $page;
        $this->pageNum = $pageNum;
    }

    /**
     * 根据页码及页数计算分片数据起始位置.
     */
    public function getSliceStart(): int
    {
        return ($this->page - 1) * $this->pageNum;
    }

    /**
     * 根据页码及页数计算分片数据结束位置.
     */
    public function getSliceEnd(): int
    {
        return $this->page * $this->pageNum - 1;
    }

    public function setNextPage(): self
    {
        $page = $this->page + 1;
        $page = $page <= 0 ? 1 : $page;
        $this->page = $page;

        return $this;
    }

    public function disable(): self
    {
        $this->enable = false;
        return $this;
    }

    public static function createNoPage(): Page
    {
        return (new self())->disable();
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPage(int $page): void
    {
        $this->page = $page;
    }

    public function getPageNum(): int
    {
        return $this->pageNum;
    }

    public function setPageNum(int $pageNum): void
    {
        $this->pageNum = $pageNum;
    }

    public function isEnable(): bool
    {
        return $this->enable;
    }

    public function setEnable(bool $enable): void
    {
        $this->enable = $enable;
    }
}
