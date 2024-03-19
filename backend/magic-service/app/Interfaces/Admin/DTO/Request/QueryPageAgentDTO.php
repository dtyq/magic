<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;

class QueryPageAgentDTO extends AbstractDTO
{
    protected int $page = 1;

    protected int $pageSize = 15;

    // 助理状态：开启/禁用
    protected ?int $status = null;

    // 创建人
    protected ?string $createdUid = null;

    // 条件查询：名称/描述
    protected ?string $query = null;

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPage(int $page): void
    {
        $this->page = $page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function setPageSize(int $pageSize): void
    {
        $this->pageSize = $pageSize;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setStatus(?int $status): void
    {
        $this->status = $status;
    }

    public function getCreatedUid(): ?string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(?string $createdUid): void
    {
        $this->createdUid = $createdUid;
    }

    public function getQuery(): ?string
    {
        return $this->query;
    }

    public function setQuery(?string $query): void
    {
        $this->query = $query;
    }
}
