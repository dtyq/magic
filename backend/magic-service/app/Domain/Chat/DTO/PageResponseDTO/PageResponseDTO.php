<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\PageResponseDTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 分页响应DTO.
 */
class PageResponseDTO extends AbstractDTO
{
    /**
     * 响应的分页Token.
     */
    protected string $pageToken = '';

    /**
     * 响应数据响应，不限制数组中的元素类型.
     */
    protected array $items = [];

    /**
     * 是否还有更多数据.
     */
    protected bool $hasMore = false;

    public function getPageToken(): string
    {
        return $this->pageToken;
    }

    public function setPageToken(string $pageToken): void
    {
        $this->pageToken = $pageToken;
    }

    public function getItems(): array
    {
        return $this->items;
    }

    public function setItems(array $items): void
    {
        $this->items = $items;
    }

    public function isHasMore(): bool
    {
        return $this->hasMore;
    }

    public function getHasMore(): bool
    {
        return $this->hasMore;
    }

    public function setHasMore(bool $hasMore): void
    {
        $this->hasMore = $hasMore;
    }
}
