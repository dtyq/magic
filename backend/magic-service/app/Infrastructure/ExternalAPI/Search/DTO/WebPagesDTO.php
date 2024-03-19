<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Web pages container for search results.
 */
class WebPagesDTO extends AbstractDTO
{
    protected int $totalEstimatedMatches = 0;

    /**
     * @var SearchResultItemDTO[]
     */
    protected array $value = [];

    public function getTotalEstimatedMatches(): int
    {
        return $this->totalEstimatedMatches;
    }

    public function setTotalEstimatedMatches(int $totalEstimatedMatches): void
    {
        $this->totalEstimatedMatches = $totalEstimatedMatches;
    }

    /**
     * @return SearchResultItemDTO[]
     */
    public function getValue(): array
    {
        return $this->value;
    }

    /**
     * @param SearchResultItemDTO[] $value
     */
    public function setValue(array $value): void
    {
        $this->value = $value;
    }

    /**
     * Add a single search result item.
     */
    public function addItem(SearchResultItemDTO $item): void
    {
        $this->value[] = $item;
    }
}
