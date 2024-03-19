<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Admin\DTO\Extra\Item\AgentItemDTO;

class GetPublishedAgentsResponseDTO extends AbstractDTO
{
    /** @var array<AgentItemDTO> */
    public array $items = [];

    public bool $hasMore = false;

    public string $pageToken = '';

    public function getItems(): array
    {
        return $this->items;
    }

    public function setItems(array $items): GetPublishedAgentsResponseDTO
    {
        $this->items = $items;
        return $this;
    }

    public function isHasMore(): bool
    {
        return $this->hasMore;
    }

    public function setHasMore(bool $hasMore): GetPublishedAgentsResponseDTO
    {
        $this->hasMore = $hasMore;
        return $this;
    }

    public function getPageToken(): string
    {
        return $this->pageToken;
    }

    public function setPageToken(string $pageToken): GetPublishedAgentsResponseDTO
    {
        $this->pageToken = $pageToken;
        return $this;
    }
}
